// client/src/app.js
// Frontend application for Planning Poker Serverless Edition

// Application state
var gameState = {
    socket: null,
    sessionCode: '',
    playerName: '',
    isSpectator: false,
    isConnected: false,
    sessionState: {
        players: {},
        votesRevealed: false,
        hasConsensus: false
    }
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Planning Poker Serverless - Starting up...');
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
    
    // Initialize socket connection
    initializeSocket();
    
    console.log('✅ Application initialized successfully');
}

function initializeSocket() {
    console.log('🔌 Connecting to serverless backend...');
    
    // For serverless, we need to detect the environment
    var isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
    
    var serverUrl;
    if (isLocal) {
        // Local serverless development
        serverUrl = 'http://localhost:3001';
        console.log('🏠 Using local serverless endpoint:', serverUrl);
    } else {
        // Production serverless (will be WebSocket API Gateway)
        serverUrl = window.location.origin;
        console.log('☁️ Using production serverless endpoint:', serverUrl);
    }
    
    gameState.socket = io(serverUrl, {
        transports: ['websocket', 'polling'], // Allow fallback to polling
        timeout: 10000, // 10 second timeout
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5
    });
    
    // Connection event handlers
    gameState.socket.on('connect', function() {
        console.log('✅ Connected to serverless backend');
        gameState.isConnected = true;
        hideError();
        hideLoading();
        updateConnectionStatus('Connected to server');
    });
    
    gameState.socket.on('disconnect', function(reason) {
        console.log('❌ Disconnected from server:', reason);
        gameState.isConnected = false;
        showLoading('Connection lost. Reconnecting...');
        updateConnectionStatus('Disconnected - ' + reason);
    });
    
    gameState.socket.on('connect_error', function(error) {
        console.error('🔥 Connection error:', error);
        showError('Unable to connect to serverless backend. Please check your connection.');
        updateConnectionStatus('Connection failed');
    });
    
    gameState.socket.on('reconnect', function(attemptNumber) {
        console.log('🔄 Reconnected after ' + attemptNumber + ' attempts');
        hideLoading();
        updateConnectionStatus('Reconnected to server');
    });
    
    gameState.socket.on('reconnect_failed', function() {
        console.error('💀 Reconnection failed');
        showError('Could not reconnect to server. Please refresh the page.');
        updateConnectionStatus('Reconnection failed');
    });
    
    // Game event handlers
    gameState.socket.on('joinedSession', function(data) {
        console.log('🎮 Joined session successfully:', data);
        
        gameState.sessionCode = data.sessionCode;
        gameState.playerName = data.playerName;
        gameState.isSpectator = data.isSpectator;
        
        // Update URL without page reload
        var newUrl = window.location.origin + window.location.pathname + '?session=' + data.sessionCode;
        window.history.pushState({}, '', newUrl);
        
        showGameInterface(data);
    });
    
    gameState.socket.on('sessionUpdate', function(sessionState) {
        console.log('📊 Session state updated:', sessionState);
        gameState.sessionState = sessionState.state || sessionState;
        updateGameInterface();
    });
    
    gameState.socket.on('votesReset', function() {
        console.log('🔄 Votes have been reset');
        clearSelectedVote();
        updateStatus('New voting round started. Cast your votes!');
        hideError();
    });
    
    gameState.socket.on('sessionEnded', function(data) {
        console.log('🚪 Session ended:', data);
        showError(data.message || 'Session has ended');
        setTimeout(function() {
            window.location.reload();
        }, 3000);
    });
    
    gameState.socket.on('error', function(data) {
        console.error('⚠️ Server error:', data);
        showError(data.message || 'An error occurred');
    });
    
    // Start with loading state
    showLoading('Connecting to serverless backend...');
}

// Join or create session
function joinSession() {
    var playerName = document.getElementById('playerName').value.trim();
    var sessionCode = document.getElementById('sessionCode').value.trim().toUpperCase();
    
    console.log('🎯 Attempting to join session:', { playerName: playerName, sessionCode: sessionCode });
    
    // Validation
    if (!playerName) {
        showError('Please enter your name');
        return;
    }
    
    if (playerName.length > 20) {
        showError('Name must be 20 characters or less');
        return;
    }
    
    if (!gameState.isConnected) {
        showError('Not connected to server. Please wait...');
        return;
    }
    
    showLoading('Joining session...');
    hideError();
    
    // Determine if creating new session or joining existing
    var isSpectator = !sessionCode; // Creator becomes spectator
    var finalSessionCode = sessionCode || generateSessionCode();
    
    console.log((isSpectator ? 'Creating' : 'Joining') + ' session: ' + finalSessionCode);
    
    // Send join request to serverless backend
    gameState.socket.emit('joinSession', {
        sessionCode: finalSessionCode,
        playerName: playerName,
        isSpectator: isSpectator
    });
}

// Cast a vote
function castVote(value) {
    console.log('🗳️ Attempting to cast vote:', value);
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (gameState.isSpectator) {
        showError('Spectators cannot vote');
        return;
    }
    
    if (gameState.sessionState.votesRevealed && gameState.sessionState.hasConsensus) {
        console.log('⏸️ Voting disabled - consensus reached');
        return;
    }
    
    // Update UI immediately for responsiveness
    updateSelectedVote(value);
    
    // Send vote to serverless backend
    gameState.socket.emit('castVote', { vote: value });
    console.log('✅ Vote sent to server');
}

// Reset votes (Spectator only)
function resetVotes() {
    console.log('🔄 Attempting to reset votes');
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (!gameState.isSpectator) {
        showError('Only spectators can reset votes');
        return;
    }
    
    gameState.socket.emit('resetVotes');
    console.log('✅ Reset request sent to server');
}

// UI Helper Functions
function showGameInterface(sessionData) {
    console.log('🎮 Showing game interface');
    
    // Hide join form
    document.getElementById('joinForm').style.display = 'none';
    
    // Show game interface
    document.getElementById('gameInterface').style.display = 'block';
    
    // Update session info
    document.getElementById('currentSessionCode').textContent = sessionData.sessionCode;
    
    // Create share URL
    var shareUrl = window.location.origin + window.location.pathname + '?session=' + sessionData.sessionCode;
    document.getElementById('shareLink').textContent = shareUrl;
    document.getElementById('shareLink').setAttribute('data-url', shareUrl);
    
    // Show spectator controls if spectator
    if (sessionData.isSpectator) {
        document.getElementById('spectatorControls').style.display = 'block';
        updateStatus('You are the Spectator. Share the link above with your team.');
    } else {
        updateStatus('Connected to session. Cast your vote when ready!');
    }
    
    hideLoading();
}

function updateGameInterface() {
    updatePlayerCards();
    updateVotingCards();
    updateStatus();
}

function updatePlayerCards() {
    var container = document.getElementById('playerCards');
    container.innerHTML = '';
    
    console.log('👥 Updating player cards:', gameState.sessionState.players);
    
    var players = gameState.sessionState.players || {};
    for (var name in players) {
        if (players.hasOwnProperty(name)) {
            var player = players[name];
            
            var playerDiv = document.createElement('div');
            playerDiv.className = 'player-card';
            
            var nameDiv = document.createElement('div');
            nameDiv.className = 'player-name' + (player.isSpectator ? ' spectator' : '');
            nameDiv.textContent = name + (player.isSpectator ? ' (Spectator)' : '');
            
            var cardDiv = document.createElement('div');
            cardDiv.className = 'vote-card';
            
            if (player.isSpectator) {
                cardDiv.classList.add('no-vote');
                cardDiv.textContent = '👁️';
            } else if (!player.hasVoted) {
                cardDiv.classList.add('no-vote');
                cardDiv.textContent = '?';
            } else if (gameState.sessionState.votesRevealed && player.vote !== null) {
                cardDiv.classList.add('revealed');
                cardDiv.textContent = player.vote;
            } else {
                cardDiv.classList.add('hidden');
                cardDiv.textContent = '✓';
            }
            
            playerDiv.appendChild(nameDiv);
            playerDiv.appendChild(cardDiv);
            container.appendChild(playerDiv);
        }
    }
}

function updateVotingCards() {
    var cards = document.querySelectorAll('.fibonacci-card');
    var shouldDisable = gameState.isSpectator || 
                       (gameState.sessionState.votesRevealed && gameState.sessionState.hasConsensus);
    
    for (var i = 0; i < cards.length; i++) {
        if (shouldDisable) {
            cards[i].classList.add('disabled');
        } else {
            cards[i].classList.remove('disabled');
        }
    }
}

function updateSelectedVote(value) {
    // Clear previous selection
    var cards = document.querySelectorAll('.fibonacci-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('selected');
    }
    
    // Select new vote
    if (value) {
        var selectedCard = document.querySelector('[data-value="' + value + '"]');
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
    }
}

function clearSelectedVote() {
    updateSelectedVote(null);
}

function updateStatus(message) {
    var statusEl = document.getElementById('status');
    
    if (message) {
        statusEl.textContent = message;
        statusEl.className = 'status';
        return;
    }
    
    // Auto-generate status based on game state
    var players = gameState.sessionState.players || {};
    var nonSpectators = [];
    var votedCount = 0;
    
    for (var name in players) {
        if (players.hasOwnProperty(name)) {
            var player = players[name];
            if (!player.isSpectator) {
                nonSpectators.push(player);
                if (player.hasVoted) {
                    votedCount++;
                }
            }
        }
    }
    
    var totalVoters = nonSpectators.length;
    
    if (totalVoters === 0) {
        statusEl.textContent = 'Waiting for voters to join...';
        statusEl.className = 'status';
    } else if (gameState.sessionState.votesRevealed) {
        if (gameState.sessionState.hasConsensus) {
            var consensusVote = null;
            for (var name in players) {
                if (players.hasOwnProperty(name)) {
                    var player = players[name];
                    if (!player.isSpectator && player.hasVoted) {
                        consensusVote = player.vote;
                        break;
                    }
                }
            }
            statusEl.innerHTML = '<div class="consensus">🎉 Consensus Reached! Story Points: ' + consensusVote + ' 🎉</div>';
        } else {
            statusEl.textContent = 'No consensus reached. Spectator can reset for re-vote.';
            statusEl.className = 'status';
        }
    } else {
        statusEl.textContent = 'Voting: ' + votedCount + '/' + totalVoters + ' players voted';
        statusEl.className = 'status';
    }
}

// Utility Functions
function generateSessionCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function copyShareLink() {
    var shareLink = document.getElementById('shareLink').getAttribute('data-url') || 
                   document.getElementById('shareLink').textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareLink).then(function() {
            showCopyFeedback('✅ Link copied to clipboard!');
        }).catch(function() {
            showCopyFeedback('❌ Unable to copy - please copy manually');
        });
    } else {
        // Fallback for older browsers
        var textArea = document.createElement('textarea');
        textArea.value = shareLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyFeedback('✅ Link copied to clipboard!');
    }
}

function showCopyFeedback(message) {
    var linkEl = document.getElementById('shareLink');
    var originalText = linkEl.textContent;
    
    linkEl.textContent = message;
    setTimeout(function() {
        linkEl.textContent = originalText;
    }, 2000);
}

// Error and Loading States
function showError(message) {
    console.error('❌ Error:', message);
    var errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(hideError, 5000);
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function showLoading(message) {
    if (!message) message = 'Loading...';
    console.log('⏳ Loading:', message);
    var loadingEl = document.getElementById('loadingState');
    loadingEl.textContent = message;
    loadingEl.style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
}

function updateConnectionStatus(status) {
    console.log('🔗 Connection status:', status);
    // Could display connection status in UI if needed
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Only handle shortcuts when in game interface
    if (document.getElementById('gameInterface').style.display === 'none') {
        return;
    }
    
    // Number keys 1-6 for Fibonacci votes
    var fibValues = [1, 2, 3, 5, 8, 13];
    var keyNum = parseInt(event.key);
    
    if (keyNum >= 1 && keyNum <= 6) {
        castVote(fibValues[keyNum - 1]);
    }
    
    // R for reset (spectator only)
    if (event.key.toLowerCase() === 'r' && gameState.isSpectator) {
        resetVotes();
    }
});

// Handle browser back/forward
window.addEventListener('popstate', function(event) {
    console.log('🔙 Browser navigation detected');
    // Refresh page if user navigates back/forward
    window.location.reload();
});

// Make functions globally available
window.joinSession = joinSession;
window.castVote = castVote;
window.resetVotes = resetVotes;
window.copyShareLink = copyShareLink;
