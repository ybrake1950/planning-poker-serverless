// serverless/game.js
// Improved game logic handlers with better error handling

const { 
  getSession, 
  createSession, 
  updateSession, 
  storeConnection, 
  getConnection,
  getConnectionsBySession,
  checkConsensus,
  debugState
} = require('./db');

const isOffline = process.env.IS_OFFLINE || process.env.NODE_ENV === 'development';

// Function to send message to WebSocket connection
async function sendToConnection(connectionId, message) {
  console.log('📤 Sending message to', connectionId + ':', message.type);
  
  if (isOffline) {
    // For local development with Socket.IO
    if (global.simulateWebSocketMessage) {
      const success = global.simulateWebSocketMessage(connectionId, message);
      if (!success) {
        console.log('❌ Failed to deliver message to', connectionId);
      }
    } else {
      console.log('💻 Local dev: Would send message to', connectionId, message);
    }
    return Promise.resolve();
  } else {
    // Production: Use API Gateway Management API
    const AWS = require('aws-sdk');
    const apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
      endpoint: process.env.WEBSOCKET_ENDPOINT
    });
    
    try {
      await apiGatewayManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify(message)
      }).promise();
    } catch (error) {
      if (error.statusCode === 410) {
        console.log('🗑️ Stale connection removed:', connectionId);
      }
      throw error;
    }
  }
}

// Broadcast message to all connections in a session
async function broadcastToSession(sessionCode, message) {
  console.log('📡 Broadcasting', message.type, 'to session:', sessionCode);
  
  try {
    const connections = await getConnectionsBySession(sessionCode);
    
    if (connections.length === 0) {
      console.log('⚠️ No connections found for session:', sessionCode);
      return;
    }
    
    console.log('🔗 Broadcasting to', connections.length, 'connections');
    
    const promises = connections.map(async (conn) => {
      try {
        await sendToConnection(conn.connectionId, message);
      } catch (error) {
        console.error('❌ Failed to send to connection:', conn.connectionId, error.message);
      }
    });
    
    await Promise.all(promises);
    console.log('✅ Broadcast completed');
    
  } catch (error) {
    console.error('❌ Broadcast error:', error);
  }
}

// Generate session code
function generateSessionCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Join session handler
exports.joinSession = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('🎮 Join session handler called for connection:', connectionId);
  
  let body;
  try {
    body = JSON.parse(event.body);
    console.log('📋 Join session data:', body);
  } catch (error) {
    console.error('❌ Invalid JSON in request body:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Invalid request format'
    });
    return { statusCode: 400 };
  }
  
  const { sessionCode: inputSessionCode, playerName, isSpectator = false } = body;
  
  try {
    // Validate input
    if (!playerName) {
      console.log('❌ Missing player name');
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Player name is required'
      });
      return { statusCode: 400 };
    }
    
    if (playerName.length > 20) {
      console.log('❌ Player name too long:', playerName.length);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Player name must be 20 characters or less'
      });
      return { statusCode: 400 };
    }
    
    // Get or create session
    const sessionCode = inputSessionCode || generateSessionCode();
    console.log('🔍 Looking for session:', sessionCode);
    
    let session = await getSession(sessionCode);
    
    if (!session) {
      console.log('📝 Creating new session:', sessionCode);
      session = await createSession(sessionCode);
      console.log('✅ New session created');
    } else {
      console.log('✅ Found existing session with', Object.keys(session.players || {}).length, 'players');
    }
    
    // Check if player name already exists
    if (session.players && session.players[playerName]) {
      console.log('❌ Player name already taken:', playerName);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Player name "' + playerName + '" is already taken in this session'
      });
      return { statusCode: 400 };
    }
    
    // Add player to session
    const updatedPlayers = {
      ...(session.players || {}),
      [playerName]: {
        hasVoted: false,
        vote: null,
        isSpectator: isSpectator,
        joinedAt: new Date().toISOString()
      }
    };
    
    console.log('👥 Adding player to session. Total players will be:', Object.keys(updatedPlayers).length);
    
    // Update session
    session = await updateSession(sessionCode, {
      players: updatedPlayers
    });
    
    if (!session) {
      throw new Error('Failed to update session');
    }
    
    // Store connection
    await storeConnection(connectionId, sessionCode, playerName, isSpectator);
    
    console.log('✅ Player', playerName, 'joined session', sessionCode, 'as', isSpectator ? 'Spectator' : 'Voter');
    
    // Send success response to joining player
    const joinResponse = {
      type: 'joinedSession',
      sessionCode: sessionCode,
      playerName: playerName,
      isSpectator: isSpectator,
      shareUrl: (process.env.FRONTEND_URL || 'http://localhost:8080') + '?session=' + sessionCode
    };
    
    console.log('📤 Sending join confirmation to', playerName);
    await sendToConnection(connectionId, joinResponse);
    
    // Broadcast updated state to all players in session
    const sessionUpdate = {
      type: 'sessionUpdate',
      state: {
        players: session.players,
        votesRevealed: session.votesRevealed || false,
        hasConsensus: checkConsensus(session)
      }
    };
    
    console.log('📡 Broadcasting session update to all players');
    await broadcastToSession(sessionCode, sessionUpdate);
    
    // Debug current state
    debugState();
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('❌ Error in joinSession:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to join session: ' + error.message
    });
    return { statusCode: 500 };
  }
};

// Cast vote handler
exports.castVote = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('🗳️ Cast vote handler called for connection:', connectionId);
  
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    console.error('❌ Invalid JSON in vote request');
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Invalid vote format'
    });
    return { statusCode: 400 };
  }
  
  const { vote } = body;
  console.log('🗳️ Vote value:', vote);
  
  try {
    // Get connection info
    const connection = await getConnection(connectionId);
    if (!connection) {
      console.log('❌ Connection not found:', connectionId);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Connection not found. Please rejoin the session.'
      });
      return { statusCode: 400 };
    }
    
    console.log('👤 Vote from player:', connection.playerName, 'in session:', connection.sessionCode);
    
    if (connection.isSpectator) {
      console.log('❌ Spectator tried to vote:', connection.playerName);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Spectators cannot vote'
      });
      return { statusCode: 400 };
    }
    
    // Validate vote
    const validVotes = [1, 2, 3, 5, 8, 13];
    if (!validVotes.includes(vote)) {
      console.log('❌ Invalid vote value:', vote);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Invalid vote value. Must be: 1, 2, 3, 5, 8, or 13'
      });
      return { statusCode: 400 };
    }
    
    // Update session with vote
    const session = await getSession(connection.sessionCode);
    if (!session) {
      console.log('❌ Session not found:', connection.sessionCode);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Session not found'
      });
      return { statusCode: 400 };
    }
    
    const updatedPlayers = {
      ...session.players,
      [connection.playerName]: {
        ...session.players[connection.playerName],
        hasVoted: true,
        vote: vote
      }
    };
    
    // Check if all non-spectators have voted
    const nonSpectators = [];
    for (const playerName in updatedPlayers) {
      const player = updatedPlayers[playerName];
      if (!player.isSpectator) {
        nonSpectators.push(player);
      }
    }
    
    const votedCount = nonSpectators.filter(p => p.hasVoted).length;
    const allVoted = nonSpectators.length > 0 && votedCount === nonSpectators.length;
    
    console.log('📊 Voting progress:', votedCount, '/', nonSpectators.length, 'players voted');
    
    const updatedSession = await updateSession(connection.sessionCode, {
      players: updatedPlayers,
      votesRevealed: allVoted || session.votesRevealed
    });
    
    console.log('✅ Vote recorded for', connection.playerName + ':', vote);
    
    if (allVoted) {
      console.log('🎉 All players have voted! Revealing votes...');
    }
    
    // Broadcast update to all players
    await broadcastToSession(connection.sessionCode, {
      type: 'sessionUpdate',
      state: {
        players: updatedSession.players,
        votesRevealed: updatedSession.votesRevealed,
        hasConsensus: checkConsensus(updatedSession)
      }
    });
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('❌ Error in castVote:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to cast vote: ' + error.message
    });
    return { statusCode: 500 };
  }
};

// Reset votes handler
exports.resetVotes = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('🔄 Reset votes handler called for connection:', connectionId);
  
  try {
    const connection = await getConnection(connectionId);
    if (!connection) {
      console.log('❌ Connection not found:', connectionId);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Connection not found'
      });
      return { statusCode: 400 };
    }
    
    if (!connection.isSpectator) {
      console.log('❌ Non-spectator tried to reset:', connection.playerName);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Only spectators can reset votes'
      });
      return { statusCode: 400 };
    }
    
    // Reset all votes in session
    const session = await getSession(connection.sessionCode);
    if (!session) {
      console.log('❌ Session not found:', connection.sessionCode);
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Session not found'
      });
      return { statusCode: 400 };
    }
    
    const resetPlayers = {};
    for (const playerName in session.players) {
      resetPlayers[playerName] = {
        ...session.players[playerName],
        hasVoted: false,
        vote: null
      };
    }
    
    await updateSession(connection.sessionCode, {
      players: resetPlayers,
      votesRevealed: false
    });
    
    console.log('✅ Votes reset by spectator', connection.playerName, 'in session', connection.sessionCode);
    
    // Broadcast reset to all players
    await broadcastToSession(connection.sessionCode, {
      type: 'votesReset'
    });
    
    await broadcastToSession(connection.sessionCode, {
      type: 'sessionUpdate',
      state: {
        players: resetPlayers,
        votesRevealed: false,
        hasConsensus: false
      }
    });
    
    return { statusCode: 200 };
    
  } catch (error) {
    console.error('❌ Error in resetVotes:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Failed to reset votes: ' + error.message
    });
    return { statusCode: 500 };
  }
};
