// In-memory version for testing without DynamoDB

// In-memory storage
const sessions = new Map();
const connections = new Map();

exports.connect = async (event) => {
  console.log('WebSocket connect:', event.requestContext.connectionId);
  return { statusCode: 200, body: 'Connected' };
};

exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('WebSocket disconnect:', connectionId);
  
  try {
    await removeConnection(connectionId);
  } catch (error) {
    console.error('Error removing connection:', error);
  }
  
  return { statusCode: 200, body: 'Disconnected' };
};

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
  
  return { statusCode: 200, body: 'Message handled' };
};

async function sendToConnection(connectionId, message) {
  console.log('Sending to connection:', connectionId, message);
  // In serverless offline, we'll just log the message
  // Real API Gateway would send via websocket
  return Promise.resolve();
}

async function broadcastToSession(sessionCode, message, excludeConnectionId = null) {
  console.log('Broadcasting to session:', sessionCode, message);
  const sessionConnections = Array.from(connections.values())
    .filter(conn => conn.sessionCode === sessionCode && conn.connectionId !== excludeConnectionId);
  
  for (const conn of sessionConnections) {
    await sendToConnection(conn.connectionId, message);
  }
}

async function handleJoinSession(connectionId, data) {
  const { sessionCode, playerName, isSpectator = false } = data;
  
  if (!playerName || playerName.length > 20) {
    await sendToConnection(connectionId, {
      type: 'error',
      message: 'Invalid player name'
    });
    return;
  }
  
  const finalSessionCode = sessionCode || generateSessionCode();
  
  try {
    let session = sessions.get(finalSessionCode);
    if (!session) {
      session = {
        sessionCode: finalSessionCode,
        players: {},
        votesRevealed: false,
        createdAt: Date.now()
      };
      sessions.set(finalSessionCode, session);
    }
    
    // Store connection
    connections.set(connectionId, {
      connectionId,
      sessionCode: finalSessionCode,
      playerName,
      isSpectator,
      connectedAt: Date.now()
    });
    
    session.players[playerName] = {
      vote: null,
      isSpectator: isSpectator,
      connectionId: connectionId
    };
    
    await sendToConnection(connectionId, {
      type: 'sessionJoined',
      data: {
        sessionCode: finalSessionCode,
        playerName: playerName,
        isSpectator: isSpectator
      }
    });
    
    await broadcastToSession(finalSessionCode, {
      type: 'sessionUpdate',
      data: {
        players: session.players,
        votesRevealed: session.votesRevealed || false,
        hasConsensus: checkConsensus(session.players)
      }
    });
    
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

async function handleCastVote(connectionId, data) {
  const { sessionCode, playerName, vote } = data;
  
  try {
    const session = sessions.get(sessionCode);
    if (!session) {
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Session not found'
      });
      return;
    }
    
    if (session.players && session.players[playerName]) {
      session.players[playerName].vote = vote;
      
      await sendToConnection(connectionId, {
        type: 'voteReceived',
        data: { vote: vote }
      });
      
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

async function handleResetVotes(connectionId, data) {
  const { sessionCode, playerName } = data;
  
  try {
    const session = sessions.get(sessionCode);
    if (!session) {
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Session not found'
      });
      return;
    }
    
    const player = session.players[playerName];
    if (!player || !player.isSpectator) {
      await sendToConnection(connectionId, {
        type: 'error',
        message: 'Only spectators can reset votes'
      });
      return;
    }
    
    Object.keys(session.players).forEach(name => {
      session.players[name].vote = null;
    });
    session.votesRevealed = false;
    
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

async function removeConnection(connectionId) {
  const connection = connections.get(connectionId);
  
  if (connection) {
    const session = sessions.get(connection.sessionCode);
    if (session && session.players && session.players[connection.playerName]) {
      delete session.players[connection.playerName];
      
      await broadcastToSession(connection.sessionCode, {
        type: 'playerLeft',
        data: { playerName: connection.playerName }
      });
      
      await broadcastToSession(connection.sessionCode, {
        type: 'sessionUpdate',
        data: {
          players: session.players,
          votesRevealed: session.votesRevealed || false,
          hasConsensus: checkConsensus(session.players)
        }
      });
    }
    
    connections.delete(connectionId);
  }
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
  return votes.every(vote => vote === votes[0]);
}
