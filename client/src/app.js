// Enhanced Planning Poker Frontend - app.js
// Directory: client/src/app.js
// Complete working version with backend connection

// Global game state
var gameState = {
    socket: null,
    isConnected: false,
    sessionState: {
        players: {},
        votesRevealed: false,
        hasConsensus: false
    },
    isSpectator: false,
    playerName: '',
    currentVote: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Planning Poker app initializing...');
    setupEventListeners();
    checkAuthentication();
    connectToServer();
    
    // Check URL parameters for session joining
    var urlParams = new URLSearchParams(window.location.search);
    var sessionCode = urlParams.get('session');
    if (sessionCode) {
        document.getElementById('sessionCode').value = sessionCode;
    }
});

// Setup event listeners
function setupEventListeners() {
    // Team password authentication
    var teamPasswordField = document.getElementById('teamPassword');
    if (teamPasswordField) {
        teamPasswordField.addEventListener('click', handlePasswordAuth);
        teamPasswordField.addEventListener('focus', handlePasswordAuth);
    }
    
    // Join button
    document.getElementById('joinButton').addEventListener('click', joinSession);
    
    // Reset buttons (both main and spectator)
    var resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetVotes);
    }
    
    var resetButtonSpectator = document.getElementById('resetButtonSpectator');
    if (resetButtonSpectator) {
        resetButtonSpectator.addEventListener('click', resetVotes);
    }
    
    // Voting cards with enhanced interaction
    var fibonacciCards = document.querySelectorAll('.fibonacci-card');
    for (var i = 0; i < fibonacciCards.length; i++) {
        fibonacciCards[i].addEventListener('click', function() {
            var value = parseInt(this.dataset.value);
            castVote(value);
        });
        
        // Keyboard support
        fibonacciCards[i].addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                var value = parseInt(this.dataset.value);
                castVote(value);
            }
        });
    }
    
    // Share link copy functionality
    document.getElementById('shareLink').addEventListener('click', copyShareLink);
    
    // Enter key to join
    document.getElementById('playerName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinSession();
        }
    });
}

// Connect to server
function connectToServer() {
    console.log('🔌 Connecting to server...');
    
    var serverUrl = 'http://localhost:3001';
    
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
        console.log('⚠️ Socket.IO not available');
        showError('Socket.IO library not loaded');
        return;
    }
    
    try {
        gameState.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true
        });
        
        // Connection established
        gameState.socket.on('connect', function() {
            console.log('✅ Connected to backend server');
            gameState.isConnected = true;
            hideError();
            hideLoading();
            showTemporaryMessage('✅ Connected to server!');
        });
        
        // Connection failed
        gameState.socket.on('connect_error', function(error) {
            console.log('❌ Connection failed:', error);
            showError('Failed to connect to server. Please check if the server is running.');
        });
        
        // Disconnect handling
        gameState.socket.on('disconnect', function() {
            console.log('❌ Disconnected from server');
            gameState.isConnected = false;
            showError('Disconnected from server');
        });
        
        // Session joined successfully
        gameState.socket.on('sessionJoined', function(data) {
            console.log('🎮 Session joined:', data);
            gameState.isSpectator = data.isSpectator;
            gameState.playerName = data.playerName;
            showGameInterface(data);
        });
        
        // Session state update
        gameState.socket.on('sessionUpdate', function(data) {
            console.log('📊 Session update received:', data);
            
            if (data.state) {
                gameState.sessionState = Object.assign(gameState.sessionState, data.state);
                updateGameInterface();
            }
        });
        
        // Votes reset notification
        gameState.socket.on('votesReset', function() {
            console.log('🔄 Votes have been reset');
            gameState.currentVote = null;
            clearSelectedVote();
            showTemporaryMessage('🔄 Votes reset - you can vote again!');
        });
        
        // Error handling
        gameState.socket.on('error', function(data) {
            console.error('❌ Server error:', data);
            showError(data.message || 'Server error occurred');
        });
        
    } catch (error) {
        console.log('❌ Socket connection error:', error);
        showError('Failed to connect to server');
    }
}

// Join or create session
function joinSession() {
    var playerName = document.getElementById('playerName').value.trim();
    var sessionCode = document.getElementById('sessionCode').value.trim();
    var isSpectator = document.getElementById('spectatorMode').checked;
    
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
    
    showLoading();
    hideError();
    
    // Determine if creating new session or joining existing
    var finalSessionCode = sessionCode || generateSessionCode();
    
    console.log('🎯 Joining session: ' + finalSessionCode + ' as ' + (isSpectator ? 'Spectator' : 'Player'));
    
    // Send join request to server
    gameState.socket.emit('joinSession', {
        sessionCode: finalSessionCode,
        playerName: playerName,
        isSpectator: isSpectator
    });
}

// Cast a vote
function castVote(value) {
    console.log('🗳️ Vote button clicked: ' + value);
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (gameState.isSpectator) {
        showError('Spectators cannot vote');
        return;
    }
    
    // Allow re-voting when no consensus, even if votes are revealed
    var canVote = !gameState.sessionState.hasConsensus;
    var isRevotingScenario = gameState.sessionState.votesRevealed && !gameState.sessionState.hasConsensus;
    
    if (!canVote) {
        console.log('🚫 Voting disabled - consensus already reached');
        showError('Consensus already reached. Spectator can reset for new voting round.');
        return;
    }
    
    // Show appropriate feedback for re-voting
    if (isRevotingScenario && gameState.currentVote !== null) {
        showTemporaryMessage('🔄 Vote changed from ' + gameState.currentVote + ' to ' + value);
    } else if (isRevotingScenario) {
        showTemporaryMessage('🗳️ Vote cast: ' + value + ' (re-voting round)');
    } else {
        showTemporaryMessage('✅ Vote recorded: ' + value);
    }
    
    console.log('🗳️ Casting vote: ' + value);
    
    // Update local state and UI immediately for responsiveness
    gameState.currentVote = value;
    updateSelectedVote(value);
    
    // Send vote to server
    gameState.socket.emit('castVote', { vote: value });
}

// Reset votes
function resetVotes() {
    console.log('🔄 Reset votes button clicked');
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (!gameState.isSpectator) {
        showError('Only spectators can reset votes');
        return;
    }
    
    console.log('🔄 Resetting votes');
    gameState.socket.emit('resetVotes');
}

// UI Helper Functions
function showGameInterface(sessionData) {
    console.log('🎮 Showing game interface:', sessionData);
    
    // Hide join form
    var joinForm = document.getElementById('joinInterface');
    if (joinForm) {
        joinForm.style.display = 'none';
    }
    
    // Show game interface
    var gameInterface = document.getElementById('gameInterface');
    if (gameInterface) {
        gameInterface.style.display = 'block';
    }
    
    // Update session info
    var sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
        sessionInfo.textContent = 'Session: ' + sessionData.sessionCode;
    }
    
    var shareLink = document.getElementById('shareLink');
    if (shareLink) {
        shareLink.textContent = sessionData.shareUrl || (window.location.origin + '?session=' + sessionData.sessionCode);
    }
    
    // Show spectator controls if spectator
    if (sessionData.isSpectator) {
        var spectatorControls = document.getElementById('spectatorControls');
        if (spectatorControls) {
            spectatorControls.style.display = 'flex';
        }
        updateStatus('👁️ You are the Spectator. Share the link above with your team.');
    } else {
        updateStatus('🎯 Connected to session. Cast your vote when ready!');
    }
    
    hideLoading();
}

function updateGameInterface() {
    updatePlayerCards();
    updateVotingCards();
    updateStatus();
    updateSpectatorControls();
}

// Enhanced Player Status Indicators
function updatePlayerCards() {
    var container = document.getElementById('playerCards');
    if (!container) return;
    
    container.innerHTML = '';
    
    var players = gameState.sessionState.players;
    var votesRevealed = gameState.sessionState.votesRevealed;
    
    // ES5 compatible object iteration
    for (var name in players) {
        if (!players.hasOwnProperty(name)) continue;
        
        var player = players[name];
        var playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        
        // Add visual state indicators
        if (!player.isSpectator) {
            if (player.hasVoted) {
                playerDiv.classList.add('has-voted');
            } else if (!votesRevealed || !gameState.sessionState.hasConsensus) {
                playerDiv.classList.add('needs-vote');
            }
        }
        
        var nameDiv = document.createElement('div');
        nameDiv.className = 'player-name' + (player.isSpectator ? ' spectator' : '');
        nameDiv.textContent = name + (player.isSpectator ? ' (Spectator)' : '');
        
        var cardDiv = document.createElement('div');
        cardDiv.className = 'vote-card';
        
        // Enhanced visual feedback for different states
        if (player.isSpectator) {
            cardDiv.classList.add('no-vote');
            cardDiv.textContent = '👁️';
        } else if (!player.hasVoted) {
            cardDiv.classList.add('no-vote');
            cardDiv.textContent = '?';
        } else if (votesRevealed && player.vote !== null) {
            cardDiv.classList.add('revealed');
            cardDiv.textContent = player.vote;
        } else {
            cardDiv.classList.add('hidden');
            cardDiv.textContent = '✓';
        }
        
        // Add status indicator below card
        var statusDiv = document.createElement('small');
        if (player.isSpectator) {
            statusDiv.textContent = 'Observing';
            statusDiv.style.color = '#6c757d';
        } else if (player.hasVoted) {
            statusDiv.textContent = 'Voted';
            statusDiv.style.color = '#28a745';
        } else {
            statusDiv.textContent = 'Thinking...';
            statusDiv.style.color = '#ffc107';
        }
        
        playerDiv.appendChild(nameDiv);
        playerDiv.appendChild(cardDiv);
        playerDiv.appendChild(statusDiv);
        container.appendChild(playerDiv);
    }
}

// Enhanced voting cards with re-voting support
function updateVotingCards() {
    var cards = document.querySelectorAll('.fibonacci-card');
    
    var canVote = !gameState.isSpectator && !gameState.sessionState.hasConsensus;
    var isReVotingScenario = gameState.sessionState.votesRevealed && !gameState.sessionState.hasConsensus;
    
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        // Remove all state classes
        card.classList.remove('disabled', 're-vote-allowed');
        
        if (canVote) {
            if (isReVotingScenario) {
                // Add special styling for re-voting scenario
                card.classList.add('re-vote-allowed');
            }
        } else {
            card.classList.add('disabled');
        }
    }
}

// Context-aware spectator controls
function updateSpectatorControls() {
    var resetButton = document.getElementById('resetButton');
    var resetButtonSpectator = document.getElementById('resetButtonSpectator');
    
    if (!gameState.isSpectator) return;
    
    var players = gameState.sessionState.players;
    var nonSpectators = [];
    
    // ES5 compatible object iteration
    for (var playerName in players) {
        if (players.hasOwnProperty(playerName)) {
            var player = players[playerName];
            if (!player.isSpectator) {
                nonSpectators.push([playerName, player]);
            }
        }
    }
    
    var hasVotes = false;
    for (var i = 0; i < nonSpectators.length; i++) {
        if (nonSpectators[i][1].hasVoted) {
            hasVotes = true;
            break;
        }
    }
    
    // Show/hide reset buttons based on votes
    var buttons = [resetButton, resetButtonSpectator];
    for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (!button) continue;
        
        if (hasVotes) {
            button.style.display = 'block';
            
            // Context-aware button text
            if (gameState.sessionState.hasConsensus) {
                button.textContent = '🆕 Start New Round';
                button.title = 'Start a new voting round';
            } else if (gameState.sessionState.votesRevealed) {
                button.textContent = '🔄 Reset for Re-vote';
                button.title = 'Allow players to change their votes';
            } else {
                button.textContent = '🔄 Reset Votes';
                button.title = 'Clear all current votes';
            }
        } else {
            button.style.display = 'none';
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

// Enhanced status messages with re-voting context
function updateStatus(message) {
    var statusEl = document.getElementById('gameStatus');
    if (!statusEl) return;
    
    if (message) {
        statusEl.innerHTML = message;
        statusEl.className = 'status';
        return;
    }
    
    // Auto-generate status based on game state
    var players = gameState.sessionState.players;
    var nonSpectators = [];
    var totalVoters = 0;
    var votedCount = 0;
    
    // ES5 compatible object iteration
    for (var playerName in players) {
        if (players.hasOwnProperty(playerName)) {
            var player = players[playerName];
            if (!player.isSpectator) {
                nonSpectators.push([playerName, player]);
                totalVoters++;
                if (player.hasVoted) {
                    votedCount++;
                }
            }
        }
    }
    
    if (totalVoters === 0) {
        statusEl.innerHTML = '⏳ Waiting for voters to join...';
        statusEl.className = 'status';
    } else if (gameState.sessionState.votesRevealed) {
        if (gameState.sessionState.hasConsensus) {
            var consensusVote = null;
            for (var i = 0; i < nonSpectators.length; i++) {
                if (nonSpectators[i][1].hasVoted) {
                    consensusVote = nonSpectators[i][1].vote;
                    break;
                }
            }
            statusEl.innerHTML = '<div class="consensus">🎉 Consensus Reached! Story Points: ' + consensusVote + ' 🎉</div>';
        } else {
            // Enhanced messaging for re-voting
            statusEl.innerHTML = '<div class="no-consensus">⚠️ No consensus reached.<br><strong>You can change your vote or wait for spectator to reset.</strong></div>';
            statusEl.className = 'status no-consensus';
        }
    } else {
        statusEl.innerHTML = '📊 Voting: ' + votedCount + '/' + totalVoters + ' players voted';
        statusEl.className = 'status';
    }
}

// Enhanced temporary message system
function showTemporaryMessage(message, duration) {
    duration = duration || 3000;
    
    // Remove any existing messages
    var existingMessages = document.querySelectorAll('.temporary-message');
    for (var i = 0; i < existingMessages.length; i++) {
        existingMessages[i].remove();
    }
    
    var messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(function() {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, duration);
}

// Utility Functions
function generateSessionCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function copyShareLink() {
    var shareLink = document.getElementById('shareLink');
    if (!shareLink) return;
    
    var shareLinkText = shareLink.textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareLinkText).then(function() {
            showTemporaryMessage('✅ Link copied to clipboard!');
        }).catch(function() {
            showTemporaryMessage('❌ Unable to copy - please copy manually');
        });
    } else {
        // Fallback for older browsers
        showTemporaryMessage('💡 Please copy the link manually');
    }
}

// Error and Loading States
function showError(message) {
    console.error('❌ Error:', message);
    var errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(hideError, 5000);
    }
}

function hideError() {
    var errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

function showLoading() {
    var loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
        loadingEl.style.display = 'block';
    }
}

function hideLoading() {
    var loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// Enhanced keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Only handle shortcuts when in game interface
    var gameInterface = document.getElementById('gameInterface');
    if (!gameInterface || gameInterface.style.display === 'none') {
        return;
    }
    
    // Number keys 1-6 for Fibonacci votes
    var fibValues = [1, 2, 3, 5, 8, 13];
    var keyNum = event.key ? parseInt(event.key) : null;
    
    if (keyNum >= 1 && keyNum <= 6) {
        event.preventDefault();
        var voteValue = fibValues[keyNum - 1];
        castVote(voteValue);
    }
    
    // 'R' key for reset (Spectator only)
    if (event.key.toLowerCase() === 'r' && gameState.isSpectator) {
        event.preventDefault();
        resetVotes();
    }
});

// Authentication Functions
function checkAuthentication() {
    var isAuthenticated = localStorage.getItem('planningPoker_authenticated') === 'true';
    
    if (isAuthenticated) {
        hidePasswordField();
        focusOnPlayerName();
    } else {
        showPasswordField();
    }
}

function handlePasswordAuth() {
    var isAuthenticated = localStorage.getItem('planningPoker_authenticated') === 'true';
    
    if (isAuthenticated) {
        showTemporaryMessage('ℹ️ Already authenticated.');
        return;
    }
    
    showPasswordModal();
}

function showPasswordModal() {
    var existingModal = document.querySelector('.password-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    var modalOverlay = document.createElement('div');
    modalOverlay.className = 'password-modal-overlay';
    modalOverlay.innerHTML = 
        '<div class="password-modal">' +
            '<h3>🔐 Enter Team Password</h3>' +
            '<p>Please enter the team password to access Planning Poker:</p>' +
            '<input type="password" id="passwordInput" placeholder="Enter password" maxlength="50">' +
            '<div class="modal-buttons">' +
                '<button id="submitPassword" class="btn-primary">Submit</button>' +
                '<button id="cancelPassword" class="btn-secondary">Cancel</button>' +
            '</div>' +
            '<div id="passwordError" class="password-error" style="display: none;"></div>' +
        '</div>';
    
    document.body.appendChild(modalOverlay);
    
    var passwordInput = document.getElementById('passwordInput');
    passwordInput.focus();
    
    document.getElementById('submitPassword').addEventListener('click', validatePassword);
    document.getElementById('cancelPassword').addEventListener('click', closePasswordModal);
    
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            validatePassword();
        }
    });
    
    var escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closePasswordModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

function validatePassword() {
    var passwordInput = document.getElementById('passwordInput');
    var enteredPassword = passwordInput.value.trim();
    var passwordError = document.getElementById('passwordError');
    
    var correctPassword = 'team2024';
    
    if (enteredPassword === correctPassword) {
        localStorage.setItem('planningPoker_authenticated', 'true');
        hidePasswordField();
        closePasswordModal();
        showTemporaryMessage('✅ Authentication successful!');
        focusOnPlayerName();
    } else {
        passwordError.textContent = '❌ Incorrect password. Please try again.';
        passwordError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
        
        var modal = document.querySelector('.password-modal');
        modal.style.animation = 'slideIn 0.5s ease-in-out';
        setTimeout(function() {
            modal.style.animation = '';
        }, 500);
    }
}

function closePasswordModal() {
    var modal = document.querySelector('.password-modal-overlay');
    if (modal) {
        modal.remove();
    }
}

function hidePasswordField() {
    var passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'none';
    }
}

function showPasswordField() {
    var passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'block';
    }
}

function focusOnPlayerName() {
    setTimeout(function() {
        var playerNameField = document.getElementById('playerName');
        if (playerNameField) {
            playerNameField.focus();
        }
    }, 100);
}

function logout() {
    localStorage.removeItem('planningPoker_authenticated');
    showPasswordField();
    showTemporaryMessage('🔓 Logged out. Please re-enter password.');
}