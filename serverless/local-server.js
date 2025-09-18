// serverless/local-server.js
// Fixed local development server with ES5 syntax (no const/let)
// Directory: serverless/local-server.js

var express = require('express');
var http = require('http');
var socketIo = require('socket.io');
var cors = require('cors');

// Set environment for local development
process.env.IS_OFFLINE = 'true';
process.env.NODE_ENV = 'development';

// Import our database functions directly (skip serverless wrapper)
var db = require('./db');
var createSession = db.createSession;
var getSession = db.getSession;
var updateSession = db.updateSession;
var storeConnection = db.storeConnection;
var getConnection = db.getConnection;
var getConnectionsBySession = db.getConnectionsBySession;
var checkConsensus = db.checkConsensus;
var debugState = db.debugState;

var app = express();
var server = http.createServer(app);

// Configure Socket.IO with CORS
var io = socketIo(server, {
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
app.post('/api/sessions', function(req, res) {
  console.log('📋 HTTP: POST /api/sessions');
  
  var sessionCode = generateSessionCode();
  
  createSession(sessionCode)
    .then(function() {
      var response = {
        sessionCode: sessionCode,
        shareUrl: 'http://localhost:8080?session=' + sessionCode
      };
      
      res.json(response);
    })
    .catch(function(error) {
      console.error('❌ HTTP API Error:', error);
      res.status(500).json({ error: error.message });
    });
});

app.get('/api/sessions/:sessionCode', function(req, res) {
  console.log('📋 HTTP: GET /api/sessions/' + req.params.sessionCode);
  
  var sessionCode = req.params.sessionCode.toUpperCase();
  
  getSession(sessionCode)
    .then(function(session) {
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      var response = {
        sessionCode: sessionCode,
        state: {
          players: session.players || {},
          votesRevealed: session.votesRevealed || false,
          hasConsensus: checkConsensus(session)
        },
        shareUrl: 'http://localhost:8080?session=' + sessionCode
      };
      
      res.json(response);
    })
    .catch(function(error) {
      console.error('❌ HTTP API Error:', error);
      res.status(500).json({ error: error.message });
    });
});

app.get('/api/health', function(req, res) {
  console.log('💚 HTTP: GET /api/health');
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0-serverless-local',
    environment: 'development'
  });
});

// WebSocket connection handling
io.on('connection', function(socket) {
  console.log('🔌 Socket.IO: Client connected:', socket.id);
  
  // Join session handler
  socket.on('joinSession', function(data) {
    console.log('🎮 Socket.IO: Join session event from', socket.id, ':', data);
    
    var sessionCode = data.sessionCode;
    var playerName = data.playerName;
    var isSpectator = data.isSpectator || false;
    
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
    var finalSessionCode = sessionCode || generateSessionCode();
    console.log('🔍 Looking for session:', finalSessionCode);
    
    getSession(finalSessionCode)
      .then(function(session) {
        if (!session) {
          console.log('📝 Creating new session:', finalSessionCode);
          return createSession(finalSessionCode);
        } else {
          console.log('✅ Found existing session with', Object.keys(session.players || {}).length, 'players');
          return session;
        }
      })
      .then(function(session) {
        // Check if player name already exists
        if (session.players && session.players[playerName]) {
          console.log('❌ Player name already taken:', playerName);
          socket.emit('error', {
            message: 'Player name "' + playerName + '" is already taken in this session'
          });
          return;
        }
        
        // Add player to session
        var updatedPlayers = {};
        // Copy existing players
        if (session.players) {
          for (var name in session.players) {
            if (session.players.hasOwnProperty(name)) {
              updatedPlayers[name] = session.players[name];
            }
          }
        }
        
        // Add new player
        updatedPlayers[playerName] = {
          hasVoted: false,
          vote: null,
          isSpectator: isSpectator,
          joinedAt: new Date().toISOString()
        };
        
        console.log('👥 Adding player to session. Total players will be:', Object.keys(updatedPlayers).length);
        
        // Update session
        return updateSession(finalSessionCode, {
          players: updatedPlayers
        }).then(function(updatedSession) {
          // Store connection
          return storeConnection(socket.id, finalSessionCode, playerName, isSpectator)
            .then(function() {
              console.log('✅ Player', playerName, 'joined session', finalSessionCode, 'as', isSpectator ? 'Spectator' : 'Voter');
              
              // Send success response to joining player
              socket.emit('joinedSession', {
                sessionCode: finalSessionCode,
                playerName: playerName,
                isSpectator: isSpectator,
                shareUrl: 'http://localhost:8080?session=' + finalSessionCode
              });
              
              // Broadcast updated state to all players in session
              var sessionUpdate = {
                state: {
                  players: updatedSession.players,
                  votesRevealed: updatedSession.votesRevealed || false,
                  hasConsensus: checkConsensus(updatedSession)
                }
              };
              
              console.log('📡 Broadcasting session update to all players in room:', finalSessionCode);
              
              // Join the socket to a room for this session
              socket.join(finalSessionCode);
              
              // Broadcast to all sockets in this session
              io.to(finalSessionCode).emit('sessionUpdate', sessionUpdate);
              
              // Debug current state
              debugState();
            });
        });
      })
      .catch(function(error) {
        console.error('❌ Error in joinSession:', error);
        socket.emit('error', {
          message: 'Failed to join session: ' + error.message
        });
      });
  });
  
  // Cast vote handler
  socket.on('castVote', function(data) {
    console.log('🗳️ Socket.IO: Cast vote event from', socket.id, ':', data);
    
    var vote = data.vote;
    
    getConnection(socket.id)
      .then(function(connection) {
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
        var validVotes = [1, 2, 3, 5, 8, 13];
        if (validVotes.indexOf(vote) === -1) {
          console.log('❌ Invalid vote value:', vote);
          socket.emit('error', {
            message: 'Invalid vote value. Must be: 1, 2, 3, 5, 8, or 13'
          });
          return;
        }
        
        // Update session with vote
        return getSession(connection.sessionCode)
          .then(function(session) {
            if (!session) {
              console.log('❌ Session not found:', connection.sessionCode);
              socket.emit('error', {
                message: 'Session not found'
              });
              return;
            }
            
            var updatedPlayers = {};
            // Copy existing players
            for (var name in session.players) {
              if (session.players.hasOwnProperty(name)) {
                updatedPlayers[name] = session.players[name];
              }
            }
            
            // Update the voting player
            updatedPlayers[connection.playerName] = {
              hasVoted: true,
              vote: vote,
              isSpectator: updatedPlayers[connection.playerName].isSpectator,
              joinedAt: updatedPlayers[connection.playerName].joinedAt
            };
            
            // Check if all non-spectators have voted
            var nonSpectators = [];
            for (var playerName in updatedPlayers) {
              if (updatedPlayers.hasOwnProperty(playerName)) {
                var player = updatedPlayers[playerName];
                if (!player.isSpectator) {
                  nonSpectators.push(player);
                }
              }
            }
            
            var votedCount = 0;
            for (var i = 0; i < nonSpectators.length; i++) {
              if (nonSpectators[i].hasVoted) {
                votedCount++;
              }
            }
            
            var allVoted = nonSpectators.length > 0 && votedCount === nonSpectators.length;
            
            console.log('📊 Voting progress:', votedCount, '/', nonSpectators.length, 'players voted');
            
            return updateSession(connection.sessionCode, {
              players: updatedPlayers,
              votesRevealed: allVoted || session.votesRevealed
            }).then(function(updatedSession) {
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
            });
          });
      })
      .catch(function(error) {
        console.error('❌ Error in castVote:', error);
        socket.emit('error', {
          message: 'Failed to cast vote: ' + error.message
        });
      });
  });
  
  // Reset votes handler
  socket.on('resetVotes', function(data) {
    console.log('🔄 Socket.IO: Reset votes event from', socket.id);
    
    getConnection(socket.id)
      .then(function(connection) {
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
        return getSession(connection.sessionCode)
          .then(function(session) {
            if (!session) {
              console.log('❌ Session not found:', connection.sessionCode);
              socket.emit('error', {
                message: 'Session not found'
              });
              return;
            }
            
            var resetPlayers = {};
            for (var playerName in session.players) {
              if (session.players.hasOwnProperty(playerName)) {
                resetPlayers[playerName] = {
                  hasVoted: false,
                  vote: null,
                  isSpectator: session.players[playerName].isSpectator,
                  joinedAt: session.players[playerName].joinedAt
                };
              }
            }
            
            return updateSession(connection.sessionCode, {
              players: resetPlayers,
              votesRevealed: false
            }).then(function() {
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
            });
          });
      })
      .catch(function(error) {
        console.error('❌ Error in resetVotes:', error);
        socket.emit('error', {
          message: 'Failed to reset votes: ' + error.message
        });
      });
  });
  
  // Handle disconnection
  socket.on('disconnect', function(reason) {
    console.log('🔌 Socket.IO: Client disconnected:', socket.id, reason);
  });
});

// Start the local development server
var PORT = process.env.PORT || 3001;

server.listen(PORT, function() {
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
process.on('SIGTERM', function() {
  console.log('🔴 Shutting down gracefully...');
  server.close(function() {
    console.log('🔒 Server closed');
    process.exit(0);
  });
});