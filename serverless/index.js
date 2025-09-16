// server/src/index.js
// Main server file for Planning Poker application
// Merged: Original WebSocket server + Serverless architecture preparation 
+ Enhanced features

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? "https://team2playscards.com" 
            : ["http://localhost:3000", "http://localhost:8080"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? "https://team2playscards.com" 
        : ["http://localhost:3000", "http://localhost:8080"],
    credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client/dist')));

// In-memory session storage
// TODO: Replace with DynamoDB for serverless production deployment
const sessions = new Map();
const sessionTimeouts = new Map();

// Session cleanup configuration
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Utility functions
function generateSessionCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function createSession(sessionCode) {
    const session = {
        id: sessionCode,
        players: new Map(),
        votesRevealed: false,
        createdAt: new Date(),
        lastActivity: new Date()
    };
    
    sessions.set(sessionCode, session);
    scheduleSessionCleanup(sessionCode);
    
    console.log(`✅ Session created: ${sessionCode}`);
    return session;
}

function scheduleSessionCleanup(sessionCode) {
    // Clear existing timeout if it exists
    if (sessionTimeouts.has(sessionCode)) {
        clearTimeout(sessionTimeouts.get(sessionCode));
    }
    
    // Set new cleanup timeout
    const timeoutId = setTimeout(() => {
        deleteSession(sessionCode);
    }, SESSION_TIMEOUT);
    
    sessionTimeouts.set(sessionCode, timeoutId);
}

function deleteSession(sessionCode) {
    if (sessions.has(sessionCode)) {
        // Notify all players that session is ending
        io.to(sessionCode).emit('sessionEnded', { 
            message: 'Session ended due to inactivity' 
        });
        
        sessions.delete(sessionCode);
        console.log(`🗑️  Session cleaned up: ${sessionCode}`);
    }
    
    if (sessionTimeouts.has(sessionCode)) {
        clearTimeout(sessionTimeouts.get(sessionCode));
        sessionTimeouts.delete(sessionCode);
    }
}

function updateSessionActivity(sessionCode) {
    if (sessions.has(sessionCode)) {
        sessions.get(sessionCode).lastActivity = new Date();
        scheduleSessionCleanup(sessionCode);
    }
}

function checkConsensus(session) {
    const votes = Array.from(session.players.values())
        .filter(player => !player.isSpectator && player.hasVoted)
        .map(player => player.vote);
    
    if (votes.length === 0) return false;
    return votes.every(vote => vote === votes[0]);
}

function getSessionState(session) {
    const players = {};
    session.players.forEach((player, name) => {
        players[name] = {
            hasVoted: player.hasVoted,
            vote: session.votesRevealed ? player.vote : null,
            isSpectator: player.isSpectator
        };
    });
    
    return {
        players,
        votesRevealed: session.votesRevealed,
        hasConsensus: session.votesRevealed ? checkConsensus(session) : 
false
    };
}

// API Routes (compatible with both Express and serverless)
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size,
        environment: process.env.NODE_ENV || 'development',
        version: '2.0-hybrid'
    });
});

app.post('/api/sessions', (req, res) => {
    const sessionCode = generateSessionCode();
    const session = createSession(sessionCode);
    
    res.json({ 
        sessionCode,
        shareUrl: 
`${req.protocol}://${req.get('host')}?session=${sessionCode}`
    });
});

app.get('/api/sessions/:sessionCode', (req, res) => {
    const { sessionCode } = req.params;
    const session = sessions.get(sessionCode.toUpperCase());
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        sessionCode: sessionCode.toUpperCase(),
        state: getSessionState(session),
        shareUrl: 
`${req.protocol}://${req.get('host')}?session=${sessionCode}`
    });
});

// Serve client application for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// WebSocket connection handling (enhanced with better error handling)
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Join session
    socket.on('joinSession', ({ sessionCode, playerName, isSpectator = 
false }) => {
        try {
            // Validate input
            if (!sessionCode || !playerName) {
                socket.emit('error', { message: 'Session code and player 
name required' });
                return;
            }
            
            if (playerName.length > 20) {
                socket.emit('error', { message: 'Player name must be 20 
characters or less' });
                return;
            }
            
            // Get or create session
            let session = sessions.get(sessionCode);
            if (!session) {
                session = createSession(sessionCode);
            }
            
            // Check if player name already exists
            if (session.players.has(playerName)) {
                socket.emit('error', { message: 'Player name already taken 
in this session' });
                return;
            }
            
            // Add player to session
            session.players.set(playerName, {
                socketId: socket.id,
                vote: null,
                hasVoted: false,
                isSpectator,
                joinedAt: new Date()
            });
            
            // Join socket room
            socket.join(sessionCode);
            
            // Store session info on socket
            socket.sessionCode = sessionCode;
            socket.playerName = playerName;
            
            updateSessionActivity(sessionCode);
            
            console.log(`👤 ${playerName} joined session ${sessionCode} as 
${isSpectator ? 'Spectator' : 'Voter'}`);
            
            // Send success response to joining player
            socket.emit('joinedSession', {
                sessionCode,
                playerName,
                isSpectator,
                shareUrl: `${req.protocol || 'http'}://${req.get ? 
req.get('host') : 'localhost:8080'}?session=${sessionCode}`
            });
            
            // Broadcast updated state to all players in session
            io.to(sessionCode).emit('sessionUpdate', 
getSessionState(session));
            
        } catch (error) {
            console.error('Error joining session:', error);
            socket.emit('error', { message: 'Failed to join session' });
        }
    });
    
    // Cast vote (enhanced with validation)
    socket.on('castVote', ({ vote }) => {
        try {
            if (!socket.sessionCode || !socket.playerName) {
                socket.emit('error', { message: 'Not in a session' });
                return;
            }
            
            const session = sessions.get(socket.sessionCode);
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }
            
            const player = session.players.get(socket.playerName);
            if (!player) {
                socket.emit('error', { message: 'Player not found in 
session' });
                return;
            }
            
            if (player.isSpectator) {
                socket.emit('error', { message: 'Spectators cannot vote' 
});
                return;
            }
            
            // Validate vote value (Fibonacci sequence)
            const validVotes = [1, 2, 3, 5, 8, 13];
            if (!validVotes.includes(vote)) {
                socket.emit('error', { message: 'Invalid vote value. Must 
be: 1, 2, 3, 5, 8, or 13' });
                return;
            }
            
            // Cast vote
            player.vote = vote;
            player.hasVoted = true;
            
            updateSessionActivity(socket.sessionCode);
            
            console.log(`🗳️  ${socket.playerName} voted ${vote} in session 
${socket.sessionCode}`);
            
            // Check if all non-spectator players have voted
            const nonSpectatorPlayers = 
Array.from(session.players.values())
                .filter(p => !p.isSpectator);
            const allVoted = nonSpectatorPlayers.length > 0 && 
                           nonSpectatorPlayers.every(p => p.hasVoted);
            
            if (allVoted && !session.votesRevealed) {
                session.votesRevealed = true;
                console.log(`👁️  Votes revealed in session 
${socket.sessionCode}`);
            }
            
            // Broadcast updated state to all players
            io.to(socket.sessionCode).emit('sessionUpdate', 
getSessionState(session));
            
        } catch (error) {
            console.error('Error casting vote:', error);
            socket.emit('error', { message: 'Failed to cast vote' });
        }
    });
    
    // Reset votes (Spectator only)
    socket.on('resetVotes', () => {
        try {
            if (!socket.sessionCode || !socket.playerName) {
                socket.emit('error', { message: 'Not in a session' });
                return;
            }
            
            const session = sessions.get(socket.sessionCode);
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }
            
            const player = session.players.get(socket.playerName);
            if (!player || !player.isSpectator) {
                socket.emit('error', { message: 'Only spectators can reset 
votes' });
                return;
            }
            
            // Reset all votes
            session.players.forEach(p => {
                p.vote = null;
                p.hasVoted = false;
            });
            session.votesRevealed = false;
            
            updateSessionActivity(socket.sessionCode);
            
            console.log(`🔄 Votes reset in session ${socket.sessionCode} 
by ${socket.playerName}`);
            
            // Broadcast reset to all players
            io.to(socket.sessionCode).emit('votesReset');
            io.to(socket.sessionCode).emit('sessionUpdate', 
getSessionState(session));
            
        } catch (error) {
            console.error('Error resetting votes:', error);
            socket.emit('error', { message: 'Failed to reset votes' });
        }
    });
    
    // Handle disconnection (enhanced cleanup)
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        if (socket.sessionCode && socket.playerName) {
            const session = sessions.get(socket.sessionCode);
            if (session) {
                session.players.delete(socket.playerName);
                console.log(`👋 ${socket.playerName} left session 
${socket.sessionCode}`);
                
                // If session is empty, clean it up after a delay
                if (session.players.size === 0) {
                    setTimeout(() => {
                        if (sessions.has(socket.sessionCode) && 
                            sessions.get(socket.sessionCode).players.size 
=== 0) {
                            deleteSession(socket.sessionCode);
                        }
                    }, 30000); // 30 second delay
                } else {
                    // Broadcast updated state to remaining players
                    io.to(socket.sessionCode).emit('sessionUpdate', 
getSessionState(session));
                }
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Planning Poker server running on port ${PORT}`);
    console.log(`📱 Client URL: http://localhost:8080`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 
'development'}`);
    console.log(`💾 Storage: In-memory (${sessions.size} active 
sessions)`);
    console.log(`🔗 Socket.IO: Ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('🔒 Server closed');
        process.exit(0);
    });
});

// Export for testing and serverless integration
module.exports = { app, server, io, sessions };
