// serverless/websocket-handler.js
// AWS Lambda handler for WebSocket API Gateway
// Directory: planning-poker/serverless/websocket-handler.js

const AWS = require('aws-sdk');

// Initialize DynamoDB client
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// Initialize API Gateway Management API for sending messages
const apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT
});

// Connection handler - when client connects
exports.connect = async (event) => {
  console.log('WebSocket connect:', event.requestContext.connectionId);
  
  return {
    statusCode: 200,
    body: 'Connected'
  };
};

// Disconnection handler - when client disconnects
exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('WebSocket disconnect:', connectionId);
  
  try {
    // Remove connection from database
    await removeConnection(connectionId);
  } catch (error) {
    console.error('Error removing connection:', error);
  }
  
  return {
    statusCode: 200,
    body: 'Disconnected'
  };
};

// Message handler - routes messages based on action
exports.message = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const body = JSON.parse(event.body);
  const action = body.action;
  const data = body.data;
  
  console.log('WebSocket message:', action, data);
  
  try {
    switch (action) {
      case 'joinSession':
        await handleJoinSession(connectionId, data);
        break;
        
      case 'castVote':
        await handleCastVote(connectionId, data);
        break;
        
      case 'resetVotes':
        await handleResetVotes(connectionId, data);
        break;
        
      default:
        await sendToConnection(connectionId, {
          type: 'error',
          message: 'Unknown action: ' + action
        });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Server error occurred'
    });
  }
  
  return {
    statusCode: 200,
    body: 'Message handled'
  };
};

// Helper function to send message to a WebSocket connection
async function sendToConnection(connectionId, message) {
  try {
    await apiGatewayManagementApi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    }).promise();
  } catch (error) {
    if (error.statusCode === 410) {
      // Connection is gone, remove it
      console.log('Stale connection removed:', connectionId);
      await removeConnection(connectionId);
    } else {
      throw error;
    }
  }
}

// Helper function to broadcast to all connections in a session
async function broadcastToSession(sessionCode, message, excludeConnectionId = null) {
  try {
    // Get all connections for this session
    const connections = await getConnectionsBySession(sessionCode);
    
    const promises = connections
      .filter(conn => conn.connectionId !== excludeConnectionId)
      .map(conn => 
        sendToConnection(conn.connectionId, message)
          .catch(error => {
            console.error('Error sending to connection:', conn.connectionId, error);
          })
      );
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error broadcasting to session:', error);
  }
}

// Handle join session
async function handleJoinSession(connectionId, data) {
  const { sessionCode, playerName, isSpectator = false } = data;
  
  // Validate input
  if (!playerName || playerName.length > 20) {
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Invalid player name'
    });
    return;
  }
  
  // Generate session code if not provided
  const finalSessionCode = sessionCode || generateSessionCode();
  
  try {
    // Get or create session
    let session = await getSession(finalSessionCode);
    if (!session) {
      session = await createSession(finalSessionCode);
    }
    
    // Store connection
    await storeConnection(connectionId, finalSessionCode, playerName, isSpectator);
    
    // Add player to session
    session.players = session.players || {};
    session.players[playerName] = {
      vote: null,
      isSpectator: isSpectator,
      connectionId: connectionId
    };
    
    // Update session in database
    await updateSession(finalSessionCode, session);
    
    // Send confirmation to player
    await sendToConnection(connectionId, {
      type: 'sessionJoined',
      data: {
        sessionCode: finalSessionCode,
        playerName: playerName,
        isSpectator: isSpectator
      }
    });
    
    // Broadcast session update to all players
    await broadcastToSession(finalSessionCode, {
      type: 'sessionUpdate',
      data: {
        players: session.players,
        votesRevealed: session.votesRevealed || false,
        hasConsensus: checkConsensus(session.players)
      }
    });
    
    // Broadcast player joined message
    await broadcastToSession(finalSessionCode, {
      type: 'playerJoined',
      data: { playerName: playerName }
    }, connectionId);
    
  } catch (error) {
    console.error('Error joining session:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to join session'
    });
  }
}

// Handle cast vote
async function handleCastVote(connectionId, data) {
  const { sessionCode, playerName, vote } = data;
  
  try {
    // Get session
    const session = await getSession(sessionCode);
    if (!session) {
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Session not found'
      });
      return;
    }
    
    // Update player vote
    if (session.players && session.players[playerName]) {
      session.players[playerName].vote = vote;
      
      // Update session in database
      await updateSession(sessionCode, session);
      
      // Send vote confirmation
      await sendToConnection(connectionId, {
        type: 'voteReceived',
        data: { vote: vote }
      });
      
      // Broadcast session update
      await broadcastToSession(sessionCode, {
        type: 'sessionUpdate',
        data: {
          players: session.players,
          votesRevealed: session.votesRevealed || false,
          hasConsensus: checkConsensus(session.players)
        }
      });
    }
    
  } catch (error) {
    console.error('Error casting vote:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to cast vote'
    });
  }
}

// Handle reset votes
async function handleResetVotes(connectionId, data) {
  const { sessionCode, playerName } = data;
  
  try {
    // Get session
    const session = await getSession(sessionCode);
    if (!session) {
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Session not found'
      });
      return;
    }
    
    // Check if player is spectator (only spectators can reset)
    const player = session.players[playerName];
    if (!player || !player.isSpectator) {
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Only spectators can reset votes'
      });
      return;
    }
    
    // Reset all votes
    Object.keys(session.players).forEach(name => {
      session.players[name].vote = null;
    });
    session.votesRevealed = false;
    
    // Update session in database
    await updateSession(sessionCode, session);
    
    // Broadcast session update
    await broadcastToSession(sessionCode, {
      type: 'sessionUpdate',
      data: {
        players: session.players,
        votesRevealed: false,
        hasConsensus: false
      }
    });
    
  } catch (error) {
    console.error('Error resetting votes:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to reset votes'
    });
  }
}

// Database helper functions
async function getSession(sessionCode) {
  const params = {
    TableName: process.env.SESSIONS_TABLE,
    Key: { sessionCode: sessionCode }
  };
  
  const result = await dynamoDb.get(params).promise();
  return result.Item;
}

async function createSession(sessionCode) {
  const session = {
    sessionCode: sessionCode,
    players: {},
    votesRevealed: false,
    createdAt: Date.now(),
    expiresAt: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 hours TTL
  };
  
  const params = {
    TableName: process.env.SESSIONS_TABLE,
    Item: session
  };
  
  await dynamoDb.put(params).promise();
  return session;
}

async function updateSession(sessionCode, session) {
  const params = {
    TableName: process.env.SESSIONS_TABLE,
    Key: { sessionCode: sessionCode },
    UpdateExpression: 'SET players = :players, votesRevealed = :votesRevealed, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':players': session.players,
      ':votesRevealed': session.votesRevealed,
      ':updatedAt': Date.now()
    }
  };
  
  await dynamoDb.update(params).promise();
}

async function storeConnection(connectionId, sessionCode, playerName, isSpectator) {
  const params = {
    TableName: process.env.CONNECTIONS_TABLE,
    Item: {
      connectionId: connectionId,
      sessionCode: sessionCode,
      playerName: playerName,
      isSpectator: isSpectator,
      connectedAt: Date.now(),
      expiresAt: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 hours TTL
    }
  };
  
  await dynamoDb.put(params).promise();
}

async function removeConnection(connectionId) {
  // First get connection details
  const getParams = {
    TableName: process.env.CONNECTIONS_TABLE,
    Key: { connectionId: connectionId }
  };
  
  try {
    const result = await dynamoDb.get(getParams).promise();
    const connection = result.Item;
    
    if (connection) {
      // Remove player from session
      const session = await getSession(connection.sessionCode);
      if (session && session.players && session.players[connection.playerName]) {
        delete session.players[connection.playerName];
        await updateSession(connection.sessionCode, session);
        
        // Broadcast player left message
        await broadcastToSession(connection.sessionCode, {
          type: 'playerLeft',
          data: { playerName: connection.playerName }
        });
        
        // Broadcast updated session state
        await broadcastToSession(connection.sessionCode, {
          type: 'sessionUpdate',
          data: {
            players: session.players,
            votesRevealed: session.votesRevealed || false,
            hasConsensus: checkConsensus(session.players)
          }
        });
      }
    }
    
    // Remove connection from database
    const deleteParams = {
      TableName: process.env.CONNECTIONS_TABLE,
      Key: { connectionId: connectionId }
    };
    
    await dynamoDb.delete(deleteParams).promise();
    
  } catch (error) {
    console.error('Error in removeConnection:', error);
  }
}

async function getConnectionsBySession(sessionCode) {
  const params = {
    TableName: process.env.CONNECTIONS_TABLE,
    IndexName: 'SessionIndex',
    KeyConditionExpression: 'sessionCode = :sessionCode',
    ExpressionAttributeValues: {
      ':sessionCode': sessionCode
    }
  };
  
  const result = await dynamoDb.query(params).promise();
  return result.Items || [];
}

function generateSessionCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function checkConsensus(players) {
  if (!players) return false;
  
  const votes = Object.values(players)
    .filter(player => !player.isSpectator && player.vote !== null && player.vote !== undefined)
    .map(player => player.vote);
  
  if (votes.length < 2) return false;
  
  // Check if all votes are the same
  return votes.every(vote => vote === votes[0]);
}