// Enhanced Planning Poker Frontend - app.js (ES5 Compatible)
// Directory: Execute from client/src/ folder
// Fixed: Removed const declarations that cause parsing errors
// Compatible with older JavaScript engines and strict mode

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

// Connect to server via Socket.IO
function connectToServer() {
    console.log('🔌 Connecting to server...');
    
    // Use current domain for production, localhost for development
    var serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : window.location.origin;
    
    // Check if io is available (Socket.IO)
    if (typeof io === 'undefined') {
        console.log('⚠️ Socket.IO not available - running in test mode');
        gameState.isConnected = false;
        showTemporaryMessage('⚠️ Running in test mode - no server connection');
        return;
    }
    
    gameState.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true
    });
    
    // Connection established
    gameState.socket.on('connect', function() {
        console.log('✅ Connected to server');
        gameState.isConnected = true;
        hideError();
        hideLoading();
    });
    
    // Connection failed
    gameState.socket.on('disconnect', function() {
        console.log('❌ Disconnected from server');
        gameState.isConnected = false;
        showError('Connection lost. Trying to reconnect...');
    });
    
    // Session joined successfully
    gameState.socket.on('sessionJoined', function(data) {
        console.log('🎮 Session joined:', data);
        gameState.isSpectator = data.isSpectator;
        gameState.playerName = data.playerName;
        showGameInterface(data);
        updateGameInterface();
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
        hideLoading();
    });
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
    
    console.log('🎯 ' + (sessionCode ? 'Joining' : 'Creating') + ' session: ' + finalSessionCode + ' as ' + (isSpectator ? 'Spectator' : 'Player'));
    
    // Send join request to server
    gameState.socket.emit('joinSession', {
        sessionCode: finalSessionCode,
        playerName: playerName,
        isSpectator: isSpectator
    });
}

// ENHANCEMENT 1: Cast a vote with dynamic vote changing support
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
    
    // ENHANCEMENT 1: Allow re-voting when no consensus, even if votes are revealed
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
    
    console.log('🗳️ Casting vote: ' + value + (isRevotingScenario ? ' (re-voting)' : ''));
    
    // Update local state and UI immediately for responsiveness
    gameState.currentVote = value;
    updateSelectedVote(value);
    
    // Add visual feedback for re-voting scenario
    if (isRevotingScenario) {
        addReVotingVisualFeedback();
    }
    
    // Send vote to server
    if (gameState.socket) {
        gameState.socket.emit('castVote', { vote: value });
    }
}

// ENHANCEMENT 2: Smart spectator reset with context-aware behavior
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
    
    // ENHANCEMENT 2: Provide contextual feedback based on current state
    var players = gameState.sessionState.players;
    var nonSpectators = [];
    
    // Convert object entries to array (ES5 compatible)
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
    
    if (!hasVotes) {
        showTemporaryMessage('ℹ️ No votes to reset');
        return;
    }
    
    var actionMessage = '';
    if (gameState.sessionState.hasConsensus) {
        actionMessage = '🆕 Starting new voting round...';
    } else if (gameState.sessionState.votesRevealed) {
        actionMessage = '🔄 Resetting for re-vote...';
    } else {
        actionMessage = '🔄 Resetting current votes...';
    }
    
    showTemporaryMessage(actionMessage);
    
    console.log('🔄 Resetting votes with context:', {
        hasConsensus: gameState.sessionState.hasConsensus,
        votesRevealed: gameState.sessionState.votesRevealed,
        votedCount: nonSpectators.filter(function(p) { return p[1].hasVoted; }).length
    });
    
    if (gameState.socket) {
        gameState.socket.emit('resetVotes');
    }
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
    
    // ENHANCEMENT 2: Show spectator controls if spectator
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
    updatePlayerCards(); // ENHANCEMENT 3
    updateVotingCards(); // ENHANCEMENT 1
    updateStatus();     
    updateSpectatorControls(); // ENHANCEMENT 2
}

// ENHANCEMENT 3: Enhanced Player Status Indicators
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
        
        // ENHANCEMENT 3: Add visual state indicators
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
        
        // ENHANCEMENT 3: Enhanced visual feedback for different states
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

// ENHANCEMENT 1: Enhanced voting cards with re-voting support
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
                // ENHANCEMENT 1: Add special styling for re-voting scenario
                card.classList.add('re-vote-allowed');
            }
        } else {
            card.classList.add('disabled');
        }
    }
}

// ENHANCEMENT 2: Context-aware spectator controls
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
            
            // ENHANCEMENT 2: Context-aware button text
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

// ENHANCEMENT 1: Enhanced status messages with re-voting context
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
            // ENHANCEMENT 1: Enhanced messaging for re-voting
            statusEl.innerHTML = '<div class="no-consensus">⚠️ No consensus reached.<br><strong>You can change your vote or wait for spectator to reset.</strong></div>';
            statusEl.className = 'status no-consensus';
        }
    } else {
        statusEl.innerHTML = '📊 Voting: ' + votedCount + '/' + totalVoters + ' players voted';
        statusEl.className = 'status';
    }
}

// ENHANCEMENT 1: Visual feedback for re-voting
function addReVotingVisualFeedback() {
    var cards = document.querySelectorAll('.fibonacci-card');
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        card.style.animation = 'gentle-pulse 1s ease-in-out';
        setTimeout(function(cardElement) {
            return function() {
                cardElement.style.animation = '';
            };
        }(card), 1000);
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
    // Check if user is already authenticated (stored in localStorage)
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
    // Remove any existing modal
    var existingModal = document.querySelector('.password-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal overlay
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
    
    // Focus on password input
    var passwordInput = document.getElementById('passwordInput');
    passwordInput.focus();
    
    // Event listeners
    document.getElementById('submitPassword').addEventListener('click', validatePassword);
    document.getElementById('cancelPassword').addEventListener('click', closePasswordModal);
    
    // Enter key support
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            validatePassword();
        }
    });
    
    // Escape key to close
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
    
    // You can customize this password or make it configurable
    var correctPassword = 'team2024'; // Change this to your desired password
    
    if (enteredPassword === correctPassword) {
        // Password correct
        localStorage.setItem('planningPoker_authenticated', 'true');
        hidePasswordField();
        closePasswordModal();
        showTemporaryMessage('✅ Authentication successful!');
        focusOnPlayerName();
    } else {
        // Password incorrect
        passwordError.textContent = '❌ Incorrect password. Please try again.';
        passwordError.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
        
        // Shake animation for the modal
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
    // Focus on player name field after authentication
    setTimeout(function() {
        var playerNameField = document.getElementById('playerName');
        if (playerNameField) {
            playerNameField.focus();
        }
    }, 100);
}

// Optional: Add logout functionality
function logout() {
    localStorage.removeItem('planningPoker_authenticated');
    showPasswordField();
    showTemporaryMessage('🔓 Logged out. Please re-enter password.');
}