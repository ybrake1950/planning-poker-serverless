// Fixed Planning Poker Backend - game.js (Socket.IO version)
// Directory: Execute from server/ folder
// Changes:
// 1. Spectators can reset votes even after consensus
// 2. Removed restriction preventing re-voting after consensus
// 3. Better state management for re-voting scenarios

const { 
  getSession, 
  updateSession, 
  getConnection,
  checkConsensus
} = require('./db');

// Cast vote handler - FIXED: Allow re-voting when no consensus
exports.handleCastVote = async (socket, data) => {
  console.log('🗳️ Cast vote event from', socket.id, '- Vote:', data.vote);
  
  try {
    const connection = await getConnection(socket.id);
    if (!connection) {
      console.log('❌ Connection not found:', socket.id);
      socket.emit('error', {
        message: 'Connection not found. Please rejoin the session.'
      });
      return;
    }
    
    console.log('👤 Vote from player:', connection.playerName, 'in session:', connection.sessionCode);
    
    if (connection.isSpectator) {
      console.log('❌ Spectator tried to vote:', connection.playerName);
      socket.emit('error', {
        message: 'Spectators cannot vote'
      });
      return;
    }
    
    // Validate vote
    const validVotes = [1, 2, 3, 5, 8, 13];
    if (!validVotes.includes(data.vote)) {
      console.log('❌ Invalid vote value:', data.vote);
      socket.emit('error', {
        message: 'Invalid vote value. Must be: 1, 2, 3, 5, 8, or 13'
      });
      return;
    }
    
    // Update session with vote
    const session = await getSession(connection.sessionCode);
    if (!session) {
      console.log('❌ Session not found:', connection.sessionCode);
      socket.emit('error', {
        message: 'Session not found'
      });
      return;
    }
    
    // FIXED: Allow re-voting - just update the vote, don't check consensus state
    const updatedPlayers = {
      ...session.players,
      [connection.playerName]: {
        ...session.players[connection.playerName],
        hasVoted: true,
        vote: data.vote
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
    
    // FIXED: Don't automatically reveal votes if they were already revealed
    // Only reveal if all voted AND votes weren't already revealed
    const shouldRevealVotes = allVoted && !session.votesRevealed;
    
    const updatedSession = await updateSession(connection.sessionCode, {
      players: updatedPlayers,
      votesRevealed: shouldRevealVotes || session.votesRevealed
    });
    
    console.log('✅ Vote recorded for', connection.playerName + ':', data.vote);
    
    if (shouldRevealVotes) {
      console.log('🎉 All players have voted! Revealing votes...');
    } else if (session.votesRevealed) {
      console.log('🔄 Vote updated during re-voting phase');
    }
    
    // Broadcast update to all players in the session
    socket.to(connection.sessionCode).emit('sessionUpdate', {
      state: {
        players: updatedSession.players,
        votesRevealed: updatedSession.votesRevealed,
        hasConsensus: checkConsensus(updatedSession)
      }
    });
    
    // Also send to the voter
    socket.emit('sessionUpdate', {
      state: {
        players: updatedSession.players,
        votesRevealed: updatedSession.votesRevealed,
        hasConsensus: checkConsensus(updatedSession)
      }
    });
    
  } catch (error) {
    console.error('❌ Error in castVote:', error);
    socket.emit('error', {
      message: 'Failed to cast vote: ' + error.message
    });
  }
};

// Reset votes handler - FIXED: Allow reset even after consensus
exports.handleResetVotes = async (socket) => {
  console.log('🔄 Reset votes event from', socket.id);
  
  try {
    const connection = await getConnection(socket.id);
    if (!connection) {
      console.log('❌ Connection not found:', socket.id);
      socket.emit('error', {
        message: 'Connection not found'
      });
      return;
    }
    
    if (!connection.isSpectator) {
      console.log('❌ Non-spectator tried to reset:', connection.playerName);
      socket.emit('error', {
        message: 'Only spectators can reset votes'
      });
      return;
    }
    
    // Reset all votes in session
    const session = await getSession(connection.sessionCode);
    if (!session) {
      console.log('❌ Session not found:', connection.sessionCode);
      socket.emit('error', {
        message: 'Session not found'
      });
      return;
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
      votesRevealed: false  // Always reset votes revealed state
    });
    
    console.log('✅ Votes reset by spectator', connection.playerName, 'in session', connection.sessionCode);
    
    // Broadcast reset notification to all players
    socket.to(connection.sessionCode).emit('votesReset');
    socket.emit('votesReset');
    
    // Broadcast updated session state
    socket.to(connection.sessionCode).emit('sessionUpdate', {
      state: {
        players: resetPlayers,
        votesRevealed: false,
        hasConsensus: false
      }
    });
    
    socket.emit('sessionUpdate', {
      state: {
        players: resetPlayers,
        votesRevealed: false,
        hasConsensus: false
      }
    });
    
  } catch (error) {
    console.error('❌ Error in resetVotes:', error);
    socket.emit('error', {
      message: 'Failed to reset votes: ' + error.message
    });
  }
};

// Join session handler with enhanced logging
exports.handleJoinSession = async (socket, data) => {
  console.log('🎯 Join session event:', data);
  
  try {
    const { sessionCode, playerName, isSpectator } = data;
    
    // Validation
    if (!sessionCode || !playerName) {
      socket.emit('error', { message: 'Session code and player name are required' });
      return;
    }
    
    if (playerName.length > 20) {
      socket.emit('error', { message: 'Player name must be 20 characters or less' });
      return;
    }
    
    // Get or create session
    let session = await getSession(sessionCode);
    
    if (!session) {
      // Create new session
      session = {
        sessionCode,
        players: {},
        votesRevealed: false,
        createdAt: new Date().toISOString()
      };
      
      console.log('🆕 Creating new session:', sessionCode);
    }
    
    // Check if player name already exists
    if (session.players[playerName]) {
      socket.emit('error', { 
        message: `Player name "${playerName}" is already taken in this session` 
      });
      return;
    }
    
    // Add player to session
    session.players[playerName] = {
      hasVoted: false,
      vote: null,
      isSpectator: isSpectator || false,
      joinedAt: new Date().toISOString()
    };
    
    // Update session
    await updateSession(sessionCode, session);
    
    // Store connection info
    await storeConnection(socket.id, sessionCode, playerName, isSpectator || false);
    
    // Join socket room
    socket.join(sessionCode);
    
    console.log(`✅ ${playerName} joined session ${sessionCode} as ${isSpectator ? 'Spectator' : 'Player'}`);
    
    // Send success response to joining player
    socket.emit('sessionJoined', {
      sessionCode,
      playerName,
      isSpectator: isSpectator || false,
      shareUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}?session=${sessionCode}`
    });
    
    // Broadcast updated session state to all players
    const updatedSession = await getSession(sessionCode);
    socket.to(sessionCode).emit('sessionUpdate', {
      state: {
        players: updatedSession.players,
        votesRevealed: updatedSession.votesRevealed,
        hasConsensus: checkConsensus(updatedSession)
      }
    });
    
    socket.emit('sessionUpdate', {
      state: {
        players: updatedSession.players,
        votesRevealed: updatedSession.votesRevealed,
        hasConsensus: checkConsensus(updatedSession)
      }
    });
    
  } catch (error) {
    console.error('❌ Error in joinSession:', error);
    socket.emit('error', {
      message: 'Failed to join session: ' + error.message
    });
  }
};

// Handle disconnect with cleanup
exports.handleDisconnect = async (socket) => {
  console.log('👋 Player disconnected:', socket.id);
  
  try {
    const connection = await getConnection(socket.id);
    if (connection) {
      console.log(`🔌 ${connection.playerName} disconnected from session ${connection.sessionCode}`);
      
      // Leave socket room
      socket.leave(connection.sessionCode);
      
      // Remove connection but keep player in session for reconnection
      // In a production app, you might want to implement a timeout
      // before removing the player completely
    }
  } catch (error) {
    console.error('❌ Error handling disconnect:', error);
  }
};