// client/src/app.js
// Planning Poker Frontend - Updated to use Native WebSockets instead of Socket.IO
// This version works with serverless WebSocket API Gateway

// Application state
var gameState = {
    websocket: null,           // Changed from socket to websocket
    sessionCode: '',
    playerName: '',
    isSpectator: false,
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    sessionState: {
        players: {},
        votesRevealed: false,
        hasConsensus: false
    }
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Planning Poker - Starting with Native WebSockets...');
    initializeApp();
});

function initializeApp() {
    console.log('📋 Initializing application...');
    
    // Check for session code in URL
    var urlParams = new URLSearchParams(window.location.search);
    var sessionFromUrl = urlParams.get('session');
    if (sessionFromUrl) {
        document.getElementById('sessionCode').value = sessionFromUrl.toUpperCase();
        console.log('🔗 Session code found in URL:', sessionFromUrl);
    }
    
    // Set up UI event handlers
    setupUIEventHandlers();
    
    // Connect to WebSocket endpoint
    connectToWebSocket();
    
    console.log('✅ Application initialized successfully');
}

function setupUIEventHandlers() {
    // Join session button
    document.getElementById('joinButton').addEventListener('click', joinSession);
    
    // Voting cards
    var cards = document.querySelectorAll('.fibonacci-card');
    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var value = parseInt(this.getAttribute('data-value'));
            castVote(value);
        });
    });
    
    // Reset buttons
    document.getElementById('resetButton').addEventListener('click', resetVotes);
    document.getElementById('resetButtonSpectator').addEventListener('click', resetVotes);
    
    // Share link button
    document.getElementById('shareLink').addEventListener('click', function() {
        var url = window.location.origin + '?session=' + gameState.sessionCode;
        navigator.clipboard.writeText(url);
        showSuccess('Share link copied to clipboard!');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Number keys 1-6 for voting
        if (event.key >= '1' && event.key <= '6' && !gameState.isSpectator) {
            var fibValues = [1, 2, 3, 5, 8, 13];
            var value = fibValues[parseInt(event.key) - 1];
            if (value) castVote(value);
        }
        
        // R key for reset (spectators only)
        if (event.key.toLowerCase() === 'r' && gameState.isSpectator) {
            resetVotes();
        }
    });
}

function connectToWebSocket() {
    console.log('🔌 Connecting to WebSocket endpoint...');
    
    // Determine WebSocket URL based on environment
    var isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
    
    var wsUrl;
    if (isLocal) {
        // Local development - use Socket.IO server for now
        wsUrl = 'ws://localhost:3001';
        console.log('🏠 Using local WebSocket server:', wsUrl);
    } else {
        // Production - use AWS API Gateway WebSocket endpoint
        // Replace YOUR_WEBSOCKET_API_ID with your actual API Gateway WebSocket API ID
        wsUrl = 'wss://wmfyys4er5.execute-api.us-east-1.amazonaws.com/prod';
        console.log('☁️ Using production WebSocket endpoint:', wsUrl);
    }
    
    try {
        // Create WebSocket connection
        gameState.websocket = new WebSocket(wsUrl);
        
        // Set up WebSocket event handlers
        setupWebSocketHandlers();
        
    } catch (error) {
        console.error('🔥 WebSocket connection error:', error);
        showError('Failed to connect to server. Please check your connection.');
    }
}

function setupWebSocketHandlers() {
    console.log('📡 Setting up WebSocket event handlers...');
    
    // Connection opened
    gameState.websocket.onopen = function(event) {
        console.log('✅ WebSocket connected successfully');
        gameState.isConnected = true;
        gameState.reconnectAttempts = 0;
        hideError();
        hideLoading();
        updateConnectionStatus('Connected to server');
    };
    
    // Message received
    gameState.websocket.onmessage = function(event) {
        try {
            var message = JSON.parse(event.data);
            console.log('📨 Received message:', message.type, message);
            handleWebSocketMessage(message);
        } catch (error) {
            console.error('🔥 Error parsing WebSocket message:', error);
        }
    };
    
    // Connection closed
    gameState.websocket.onclose = function(event) {
        console.log('❌ WebSocket connection closed:', event.code, event.reason);
        gameState.isConnected = false;
        updateConnectionStatus('Disconnected from server');
        
        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && gameState.reconnectAttempts < gameState.maxReconnectAttempts) {
            scheduleReconnect();
        } else {
            showError('Connection lost. Please refresh the page to reconnect.');
        }
    };
    
    // Connection error
    gameState.websocket.onerror = function(error) {
        console.error('🔥 WebSocket error:', error);
        showError('Connection error. Please check your internet connection.');
    };
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'sessionUpdate':
            handleSessionUpdate(message.data);
            break;
            
        case 'voteReceived':
            console.log('✅ Vote received:', message.data);
            break;
            
        case 'sessionJoined':
            handleSessionJoined(message.data);
            break;
            
        case 'error':
            showError(message.message || 'Server error occurred');
            break;
            
        case 'playerJoined':
            showSuccess(message.data.playerName + ' joined the session');
            break;
            
        case 'playerLeft':
            showSuccess(message.data.playerName + ' left the session');
            break;
            
        default:
            console.log('🤔 Unknown message type:', message.type);
    }
}

function sendWebSocketMessage(type, data) {
    if (!gameState.websocket || gameState.websocket.readyState !== WebSocket.OPEN) {
        console.error('❌ WebSocket not connected');
        showError('Not connected to server. Please wait for connection.');
        return false;
    }
    
    var message = {
        action: type,  // API Gateway WebSocket uses 'action' field for routing
        data: data
    };
    
    console.log('📤 Sending message:', type, data);
    gameState.websocket.send(JSON.stringify(message));
    return true;
}

function scheduleReconnect() {
    gameState.reconnectAttempts++;
    var delay = Math.min(gameState.reconnectDelay * Math.pow(2, gameState.reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Scheduling reconnect attempt ${gameState.reconnectAttempts}/${gameState.maxReconnectAttempts} in ${delay}ms`);
    showLoading(`Reconnecting... (attempt ${gameState.reconnectAttempts}/${gameState.maxReconnectAttempts})`);
    
    setTimeout(function() {
        if (gameState.websocket.readyState === WebSocket.CLOSED) {
            connectToWebSocket();
        }
    }, delay);
}

// Game Logic Functions
function joinSession() {
    var playerName = document.getElementById('playerName').value.trim();
    var sessionCode = document.getElementById('sessionCode').value.trim().toUpperCase();
    var isSpectator = document.getElementById('isSpectator').checked;
    
    // Validate input
    if (!playerName || playerName.length > 20) {
        showError('Please enter a valid player name (1-20 characters)');
        return;
    }
    
    // Store player info
    gameState.playerName = playerName;
    gameState.sessionCode = sessionCode;
    gameState.isSpectator = isSpectator;
    
    // Send join request via WebSocket
    if (!sendWebSocketMessage('joinSession', {
        sessionCode: sessionCode,
        playerName: playerName,
        isSpectator: isSpectator
    })) {
        return; // Connection error already shown
    }
    
    showLoading('Joining session...');
}

function castVote(value) {
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (gameState.isSpectator) {
        showError('Spectators cannot vote');
        return;
    }
    
    if (!gameState.sessionCode) {
        showError('Not in a session');
        return;
    }
    
    console.log('🗳️ Casting vote:', value);
    
    // Send vote via WebSocket
    if (sendWebSocketMessage('castVote', {
        sessionCode: gameState.sessionCode,
        playerName: gameState.playerName,
        vote: value
    })) {
        // Update UI to show selected card
        updateSelectedCard(value);
        showSuccess('Vote cast: ' + value);
    }
}

function resetVotes() {
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (!gameState.sessionCode) {
        showError('Not in a session');
        return;
    }
    
    console.log('🔄 Resetting votes...');
    
    // Send reset request via WebSocket
    if (sendWebSocketMessage('resetVotes', {
        sessionCode: gameState.sessionCode,
        playerName: gameState.playerName
    })) {
        showSuccess('Votes reset');
    }
}

// UI Update Functions
function handleSessionJoined(data) {
    console.log('✅ Successfully joined session:', data);
    
    gameState.sessionCode = data.sessionCode;
    hideLoading();
    
    // Show session interface
    document.getElementById('joinForm').style.display = 'none';
    document.getElementById('sessionInterface').style.display = 'block';
    
    // Update session info
    document.getElementById('currentSessionCode').textContent = data.sessionCode;
    document.getElementById('currentPlayerName').textContent = gameState.playerName;
    
    // Show appropriate controls
    if (gameState.isSpectator) {
        document.getElementById('votingCards').style.display = 'none';
        document.getElementById('resetButtonSpectator').style.display = 'inline-block';
        document.getElementById('resetButton').style.display = 'none';
    } else {
        document.getElementById('votingCards').style.display = 'block';
        document.getElementById('resetButtonSpectator').style.display = 'none';
        document.getElementById('resetButton').style.display = 'inline-block';
    }
    
    // Update URL without reload
    var newUrl = window.location.origin + window.location.pathname + '?session=' + data.sessionCode;
    window.history.pushState({}, '', newUrl);
    
    showSuccess('Joined session: ' + data.sessionCode);
}

function handleSessionUpdate(data) {
    console.log('📊 Session update received:', data);
    
    gameState.sessionState = data;
    
    // Update players list
    updatePlayersList(data.players);
    
    // Update vote reveal state
    if (data.votesRevealed) {
        revealAllVotes(data.players);
    } else {
        hideAllVotes();
    }
    
    // Update consensus indicator
    updateConsensusStatus(data.hasConsensus);
}

function updatePlayersList(players) {
    var playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    if (!players || Object.keys(players).length === 0) {
        playersList.innerHTML = '<div class="player-item">Waiting for players...</div>';
        return;
    }
    
    Object.keys(players).forEach(function(playerName) {
        var player = players[playerName];
        var playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        var hasVoted = player.vote !== null && player.vote !== undefined;
        var voteDisplay = '';
        
        if (gameState.sessionState.votesRevealed && hasVoted) {
            voteDisplay = ' - ' + player.vote;
        } else if (hasVoted) {
            voteDisplay = ' ✓';
        }
        
        var spectatorLabel = player.isSpectator ? ' (Spectator)' : '';
        playerDiv.textContent = playerName + spectatorLabel + voteDisplay;
        
        if (hasVoted && !gameState.sessionState.votesRevealed) {
            playerDiv.classList.add('voted');
        }
        
        if (player.isSpectator) {
            playerDiv.classList.add('spectator');
        }
        
        playersList.appendChild(playerDiv);
    });
}

function updateSelectedCard(value) {
    // Remove previous selection
    var cards = document.querySelectorAll('.fibonacci-card');
    cards.forEach(function(card) {
        card.classList.remove('selected');
    });
    
    // Add selection to clicked card
    var selectedCard = document.querySelector('[data-value="' + value + '"]');
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
}

function revealAllVotes(players) {
    console.log('👁️ Revealing all votes');
    updatePlayersList(players);
}

function hideAllVotes() {
    console.log('🙈 Hiding all votes');
    // Remove selected state from cards
    var cards = document.querySelectorAll('.fibonacci-card');
    cards.forEach(function(card) {
        card.classList.remove('selected');
    });
}

function updateConsensusStatus(hasConsensus) {
    // You can add consensus indicator UI here
    if (hasConsensus) {
        console.log('🎯 Consensus reached!');
        showSuccess('Consensus reached!');
    }
}

// Utility Functions
function showError(message) {
    console.error('❌ Error:', message);
    var errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(hideError, 5000);
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

function showLoading(message) {
    var loadingDiv = document.getElementById('loading');
    loadingDiv.textContent = message || 'Loading...';
    loadingDiv.style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showSuccess(message) {
    console.log('✅ Success:', message);
    // You can implement a success notification UI here
    // For now, we'll use a temporary toast-like message
    var successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px; border-radius: 5px; z-index: 1000;';
    
    document.body.appendChild(successDiv);
    
    setTimeout(function() {
        document.body.removeChild(successDiv);
    }, 3000);
}

function updateConnectionStatus(status) {
    var statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.textContent = status;
    }
}

// Debug functions (for development)
function debugRoleInterface() {
    console.log('🐛 Debug - Current game state:', gameState);
    alert('Player: ' + gameState.playerName + '\nSpectator: ' + gameState.isSpectator + '\nSession: ' + gameState.sessionCode);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (gameState.websocket && gameState.websocket.readyState === WebSocket.OPEN) {
        gameState.websocket.close(1000, 'Page unload');
    }
});