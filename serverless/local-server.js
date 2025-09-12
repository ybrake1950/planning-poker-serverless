// serverless/local-server.js
// Simplified local development server with proper Socket.IO integration

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Set environment for local development
process.env.IS_OFFLINE = 'true';
process.env.NODE_ENV = 'development';

// Import our database functions directly (skip serverless wrapper)
const { 
  createSession, 
  getSession, 
  updateSession, 
  storeConnection, 
  getConnection,
  getConnectionsBySession,
  checkConsensus,
  debugState
} = require('./db');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Express middleware
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));
app.use(express.json());

// Generate session code
function generateSessionCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// HTTP API routes
app.post('/api/sessions', async (req, res) => {
  console.log('📋 HTTP: POST /api/sessions');
  
  try {
    const sessionCode = generateSessionCode();
    await createSession(sessionCode);
    
    const response = {
      sessionCode: sessionCode,
      shareUrl: 'http://localhost:8080?session=' + sessionCode
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ HTTP API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:sessionCode', async (req, res) => {
  console.log('📋 HTTP: GET /api/sessions/' + req.params.sessionCode);
  
  try {
    const sessionCode = req.params.sessionCode.toUpperCase();
    const session = await getSession(sessionCode);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const response = {
      sessionCode: sessionCode,
      state: {
        players: session.players || {},
        votesRevealed: session.votesRevealed || false,
        hasConsensus: checkConsensus(session)
      },
      shareUrl: 'http://localhost:8080?session=' + sessionCode
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ HTTP API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  console.log('💚 HTTP: GET /api/health');
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0-serverless-local',
    environment: 'development'
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Socket.IO: Client connected:', socket.id);
  
  // Join session handler
  socket.on('joinSession', async (data) => {
    console.log('🎮 Socket.IO: Join session event from', socket.id, ':', data);
    
    try {
      const { sessionCode: inputSessionCode, playerName, isSpectator = false } = data;
      
      // Validate input
      if (!playerName) {
        console.log('❌ Missing player name');
        socket.emit('error', { message: 'Player name is required' });
        return;
      }
      
      if (playerName.length > 20) {
        console.log('❌ Player name too long:', playerName.length);
        socket.emit('error', { message: 'Player name must be 20 characters or less' });
        return;
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
        socket.emit('error', {
          message: 'Player name "' + playerName + '" is already taken in this session'
        });
        return;
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
      
      // Store connection
      await storeConnection(socket.id, sessionCode, playerName, isSpectator);
      
      console.log('✅ Player', playerName, 'joined session', sessionCode, 'as', isSpectator ? 'Spectator' : 'Voter');
      
      // Send success response to joining player
      socket.emit('joinedSession', {
        sessionCode: sessionCode,
        playerName: playerName,
        isSpectator: isSpectator,
        shareUrl: 'http://localhost:8080?session=' + sessionCode
      });
      
      // Broadcast updated state to all players in session
      const sessionUpdate = {
        state: {
          players: session.players,
          votesRevealed: session.votesRevealed || false,
          hasConsensus: checkConsensus(session)
        }
      };
      
      console.log('📡 Broadcasting session update to all players in room:', sessionCode);
      
      // Join the socket to a room for this session
      socket.join(sessionCode);
      
      // Broadcast to all sockets in this session
      io.to(sessionCode).emit('sessionUpdate', sessionUpdate);
      
      // Debug current state
      debugState();
      
    } catch (error) {
      console.error('❌ Error in joinSession:', error);
      socket.emit('error', {
        message: 'Failed to join session: ' + error.message
      });
    }
  });
  
  // Cast vote handler
  socket.on('castVote', async (data) => {
    console.log('🗳️ Socket.IO: Cast vote event from', socket.id, ':', data);
    
    try {
      const { vote } = data;
      
      // Get connection info
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
      if (!validVotes.includes(vote)) {
        console.log('❌ Invalid vote value:', vote);
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
      
      // Broadcast update to all players in the session
      io.to(connection.sessionCode).emit('sessionUpdate', {
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
  });
  
  // Reset votes handler
  socket.on('resetVotes', async (data) => {
    console.log('🔄 Socket.IO: Reset votes event from', socket.id);
    
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
        votesRevealed: false
      });
      
      console.log('✅ Votes reset by spectator', connection.playerName, 'in session', connection.sessionCode);
      
      // Broadcast reset to all players
      io.to(connection.sessionCode).emit('votesReset');
      
      io.to(connection.sessionCode).emit('sessionUpdate', {
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
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.IO: Client disconnected:', socket.id, reason);
  });
});

// Start the local development server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('🚀 Planning Poker Local Development Server');
  console.log('📍 Server: http://localhost:' + PORT);
  console.log('🔗 Socket.IO: ws://localhost:' + PORT);
  console.log('🌐 CORS: http://localhost:8080');
  console.log('💾 Storage: In-memory (local development)');
  console.log('');
  console.log('✅ Ready for connections!');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down gracefully...');
  server.close(() => {
    console.log('🔒 Server closed');
    process.exit(0);
  });
});
