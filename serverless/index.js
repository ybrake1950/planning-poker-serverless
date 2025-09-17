// serverless/index.js
// Updated Planning Poker server with password protection
// Enhanced version of your existing server

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
            : ["http://localhost:3000", "http://localhost:8080"],
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? "https://team2playscards.com" 
        : ["http://localhost:3000", "http://localhost:8080"],
    credentials: true
}));

// Body parsing middleware
app.use(express.json());

// Password Protection Configuration
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || 'planning2024';
console.log('🔒 Password protection enabled. Team password set.');

// In-memory session storage
const sessions = new Map();
const sessionTimeouts = new Map();

// Session cleanup configuration
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Utility functions
function generateSessionCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function validatePassword(providedPassword) {
    return providedPassword && providedPassword === TEAM_PASSWORD;
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
    if (sessionTimeouts.has(sessionCode)) {
        clearTimeout(sessionTimeouts.get(sessionCode));
    }
    
    const timeoutId = setTimeout(() => {
        deleteSession(sessionCode);
    }, SESSION_TIMEOUT);
    
    sessionTimeouts.set(sessionCode, timeoutId);
}

function deleteSession(sessionCode) {
    if (sessions.has(sessionCode)) {
        io.to(sessionCode).emit('sessionEnded', { 
            message: 'Session ended due to inactivity' 
        });
        
        sessions.delete(sessionCode);
        console.log(`🗑️ Session cleaned up: ${sessionCode}`);
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
        .filter(player => player.hasVoted && !player.isSpectator)
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

// API Routes with Password Protection

// Health check endpoint (no password required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0-password-protected',
        passwordProtected: true
    });
});

// Password validation middleware for API routes
function requirePassword(req, res, next) {
    const providedPassword = req.headers['x-team-password'] || req.body.password;
    
    if (!validatePassword(providedPassword)) {
        return res.status(401).json({
            error: 'Access denied',
            message: 'Valid team password required',
            code: 'INVALID_PASSWORD'
        });
    }
    
    next();
}

// Create session endpoint (password required)
app.post('/api/sessions', requirePassword, (req, res) => {
    try {
        const sessionCode = generateSessionCode();
        createSession(sessionCode);
        
        const frontendUrl = process.env.NODE_ENV === 'production' 
            ? 'https://team2playscards.com' 
            : 'http://localhost:8080';
        
        res.json({
            sessionCode: sessionCode,
            shareUrl: `${frontendUrl}?session=${sessionCode}`,
            message: 'Session created successfully'
        });
        
        console.log(`📋 Session created via API: ${sessionCode}`);
        
    } catch (error) {
        console.error('❌ Error creating session:', error);
        res.status(500).json({
            error: 'Failed to create session',
            message: error.message
        });
    }
});

// Get session endpoint (password required)
app.get('/api/sessions/:sessionCode', requirePassword, (req, res) => {
    try {
        const sessionCode = req.params.sessionCode.toUpperCase();
        const session = sessions.get(sessionCode);
        
        if (!session) {
            return res.status(404).json({
                error: 'Session not found',
                sessionCode: sessionCode
            });
        }
        
        res.json({
            sessionCode: sessionCode,
            state: getSessionState(session),
            createdAt: session.createdAt,
            lastActivity: session.lastActivity
        });
        
    } catch (error) {
        console.error('❌ Error getting session:', error);
        res.status(500).json({
            error: 'Failed to get session',
            message: error.message
        });
    }
});

// WebSocket Connection with Password Protection
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    // Join session with password validation
    socket.on('joinSession', (data) => {
        const { sessionCode, playerName, password, isSpectator } = data;
        
        // Validate password
        if (!validatePassword(password)) {
            console.log(`❌ Invalid password attempt from ${playerName} (${socket.id})`);
            socket.emit('error', {
                message: 'Invalid team password. Please check with your team admin.',
                code: 'INVALID_PASSWORD'
            });
            return;
        }
        
        // Validate required fields
        if (!playerName || playerName.trim().length === 0) {
            socket.emit('error', {
                message: 'Player name is required',
                code: 'MISSING_NAME'
            });
            return;
        }
        
        const cleanPlayerName = playerName.trim();
        const cleanSessionCode = sessionCode ? sessionCode.trim().toUpperCase() : generateSessionCode();
        
        console.log(`✅ Authorized user ${cleanPlayerName} joining session ${cleanSessionCode}`);
        
        updateSessionActivity(cleanSessionCode);
        
        // Create session if it doesn't exist
        if (!sessions.has(cleanSessionCode)) {
            createSession(cleanSessionCode);
        }
        
        const session = sessions.get(cleanSessionCode);
        
        // Check if player name is already taken (unless reconnecting)
        if (session.players.has(cleanPlayerName)) {
            const existingPlayer = session.players.get(cleanPlayerName);
            // Allow reconnection by updating socket ID
            existingPlayer.socketId = socket.id;
            console.log(`🔄 Player ${cleanPlayerName} reconnected to session ${cleanSessionCode}`);
        } else {
            // Add new player to session
            session.players.set(cleanPlayerName, {
                hasVoted: false,
                vote: null,
                isSpectator: Boolean(isSpectator),
                socketId: socket.id,
                joinedAt: new Date()
            });
            console.log(`➕ Player ${cleanPlayerName} joined session ${cleanSessionCode} as ${isSpectator ? 'spectator' : 'voter'}`);
        }
        
        // Join socket room
        socket.join(cleanSessionCode);
        
        // Store session info on socket for cleanup
        socket.sessionCode = cleanSessionCode;
        socket.playerName = cleanPlayerName;
        
        // Send session state to all players
        const sessionState = getSessionState(session);
        sessionState.sessionCode = cleanSessionCode;
        
        io.to(cleanSessionCode).emit('sessionUpdate', sessionState);
        
        // Send success confirmation to joining player
        socket.emit('joinSuccess', {
            sessionCode: cleanSessionCode,
            playerName: cleanPlayerName,
            isSpectator: Boolean(isSpectator)
        });
    });
    
    // Cast vote
    socket.on('castVote', (data) => {
        const { sessionCode, vote } = data;
        
        if (!sessionCode || !sessions.has(sessionCode)) {
            socket.emit('error', { message: 'Invalid session' });
            return;
        }
        
        if (!socket.playerName) {
            socket.emit('error', { message: 'Player not identified' });
            return;
        }
        
        const session = sessions.get(sessionCode);
        const player = session.players.get(socket.playerName);
        
        if (!player) {
            socket.emit('error', { message: 'Player not found in session' });
            return;
        }
        
        if (player.isSpectator) {
            socket.emit('error', { message: 'Spectators cannot vote' });
            return;
        }
        
        if (session.votesRevealed) {
            socket.emit('error', { message: 'Voting has ended for this round' });
            return;
        }
        
        // Record the vote
        player.hasVoted = true;
        player.vote = vote;
        updateSessionActivity(sessionCode);
        
        console.log(`🗳️ ${socket.playerName} voted ${vote} in session ${sessionCode}`);
        
        // Check if all players have voted (excluding spectators)
        const votingPlayers = Array.from(session.players.values()).filter(p => !p.isSpectator);
        const allVoted = votingPlayers.length > 0 && votingPlayers.every(p => p.hasVoted);
        
        if (allVoted) {
            session.votesRevealed = true;
            console.log(`🎉 All players voted in session ${sessionCode} - revealing votes`);
        }
        
        // Send updated session state
        const sessionState = getSessionState(session);
        sessionState.sessionCode = sessionCode;
        io.to(sessionCode).emit('sessionUpdate', sessionState);
    });
    
    // Reset votes (spectators only)
    socket.on('resetVotes', (data) => {
        const { sessionCode } = data;
        
        if (!sessionCode || !sessions.has(sessionCode)) {
            socket.emit('error', { message: 'Invalid session' });
            return;
        }
        
        if (!socket.playerName) {
            socket.emit('error', { message: 'Player not identified' });
            return;
        }
        
        const session = sessions.get(sessionCode);
        const player = session.players.get(socket.playerName);
        
        if (!player || !player.isSpectator) {
            socket.emit('error', { message: 'Only spectators can reset votes' });
            return;
        }
        
        // Reset all votes
        session.players.forEach((playerData) => {
            if (!playerData.isSpectator) {
                playerData.hasVoted = false;
                playerData.vote = null;
            }
        });
        
        session.votesRevealed = false;
        updateSessionActivity(sessionCode);
        
        console.log(`🔄 Votes reset by spectator ${socket.playerName} in session ${sessionCode}`);
        
        // Send updated session state
        const sessionState = getSessionState(session);
        sessionState.sessionCode = sessionCode;
        io.to(sessionCode).emit('sessionUpdate', sessionState);
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        if (socket.sessionCode && socket.playerName) {
            const session = sessions.get(socket.sessionCode);
            if (session && session.players.has(socket.playerName)) {
                // Don't remove player immediately - they might reconnect
                // Just log the disconnection
                console.log(`👋 ${socket.playerName} disconnected from session ${socket.sessionCode}`);
            }
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: 'Something went wrong on our end'
    });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Planning Poker server running on port ${PORT}`);
    console.log(`🔒 Password protection: ${TEAM_PASSWORD ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📝 CORS origins: ${process.env.NODE_ENV === 'production' ? 'team2playscards.com' : 'localhost:3000, localhost:8080'}`);
});