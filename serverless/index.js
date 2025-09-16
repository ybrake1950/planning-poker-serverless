// serverless/index.js
// Main server file for Planning Poker application
// Merged: Original WebSocket server + Serverless architecture preparation
// Enhanced features

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with CORS
const io = socketIo(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? "https://team2playscards.com" 
            : "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? "https://team2playscards.com" 
        : "http://localhost:3000",
    credentials: true
}));

// Body parsing middleware
app.use(express.json());

// In-memory session storage
// NOTE: In production serverless, this would be DynamoDB
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
        .filter(player => player.hasVoted)
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
        hasConsensus: session.votesRevealed ? checkConsensus(session) : false
    };
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeSessions: sessions.size
    });
});

app.post('/api/sessions', (req, res) => {
    const sessionCode = generateSessionCode();
    const session = createSession(sessionCode);
    
    res.json({ 
        sessionCode,
        shareUrl: `${req.protocol}://${req.get('host')}?session=${sessionCode}`
    });
});

app.get('/api/sessions/:sessionCode', (req, res) => {
    const { sessionCode } = req.params;
    const session = sessions.get(sessionCode);
    
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
        sessionCode,
        state: getSessionState(session),
        shareUrl: `${req.protocol}://${req.get('host')}?session=${sessionCode}`
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Join session
    socket.on('joinSession', ({ sessionCode, playerName, isSpectator = false }) => {
        try {
            // Validate input
            if (!sessionCode || !playerName) {
                socket.emit('error', { message: 'Session code and player name required' });
                return;
            }
            
            if (playerName.length > 20) {
                socket.emit('error', { message: 'Player name must be 20 characters or less' });
                return;
            }
            
            // Get or create session
            let session = sessions.get(sessionCode);
            if (!session) {
                session = createSession(sessionCode);
            }
            
            // Check if player name already exists
            if (session.players.has(playerName)) {
                socket.emit('error', { message: 'Player name already taken in this session' });
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
            
            console.log(`👤 ${playerName} joined session ${sessionCode} as ${isSpectator ? 'Spectator' : 'Voter'}`);
            
            // Send success response to joining player
            socket.emit('joinedSession', {
                sessionCode,
                playerName,
                isSpectator,
                shareUrl: `http://localhost:3000?session=${sessionCode}`
            });
            
            // Broadcast updated state to all players in session
            io.to(sessionCode).emit('sessionUpdate', getSessionState(session));
            
        } catch (error) {
            console.error('Error joining session:', error);
            socket.emit('error', { message: 'Failed to join session' });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        if (socket.sessionCode && socket.playerName) {
            const session = sessions.get(socket.sessionCode);
            if (session) {
                session.players.delete(socket.playerName);
                console.log(`👋 ${socket.playerName} left session ${socket.sessionCode}`);
                
                // If session is empty, clean it up after a delay
                if (session.players.size === 0) {
                    setTimeout(() => {
                        if (sessions.has(socket.sessionCode) && 
                            sessions.get(socket.sessionCode).players.size === 0) {
                            deleteSession(socket.sessionCode);
                        }
                    }, 30000); // 30 second delay
                } else {
                    // Broadcast updated state to remaining players
                    io.to(socket.sessionCode).emit('sessionUpdate', getSessionState(session));
                }
            }
        }
    });
});

// Export for testing
module.exports = { app, server, io };
// Add to your server/src/index.js file

// Environment variable for team password
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || 'Prime2025'; // Set this in production

// Add this middleware before your existing routes
app.use('/api/sessions', (req, res, next) => {
    // Skip password check for health endpoint
    if (req.path === '/health') {
        return next();
    }
    
    const providedPassword = req.headers['x-team-password'] || req.body.password;
    
    if (!providedPassword || providedPassword !== TEAM_PASSWORD) {
        return res.status(401).json({
            error: 'Access denied',
            message: 'Valid team password required'
        });
    }
    
    next();
});

// Modify your WebSocket connection to check password
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Require password for joining sessions
    socket.on('joinSession', (data) => {
        const { sessionCode, playerName, password, isSpectator } = data;
        
        // Check password for WebSocket connections
        if (!password || password !== TEAM_PASSWORD) {
            socket.emit('error', {
                message: 'Invalid team password'
            });
            return;
        }
        
        // Continue with existing joinSession logic...
        updateSessionActivity(sessionCode);
        
        if (!sessions.has(sessionCode)) {
            createSession(sessionCode);
        }
        
        const session = sessions.get(sessionCode);
        
        // Add player to session
        session.players.set(playerName, {
            hasVoted: false,
            vote: null,
            isSpectator: Boolean(isSpectator),
            socketId: socket.id
        });
        
        socket.join(sessionCode);
        
        // Send session state to all players
        io.to(sessionCode).emit('sessionUpdate', getSessionState(session));
        
        console.log(`Player ${playerName} joined session ${sessionCode}`);
    });
    
    // Rest of your existing WebSocket handlers...
});