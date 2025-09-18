// client/src/app.js
// Fixed Planning Poker Frontend - Connection Issue Resolved + Password Modal
// Directory: client/src/app.js

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
    // Team password button
    var teamPasswordBtn = document.getElementById('teamPasswordBtn');
    if (teamPasswordBtn) {
        teamPasswordBtn.addEventListener('click', handlePasswordAuth);
    }
    
    // Join button
    document.getElementById('joinButton').addEventListener('click', joinSession);
    
    // Reset buttons
    var resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetVotes);
    }
    
    var resetButtonSpectator = document.getElementById('resetButtonSpectator');
    if (resetButtonSpectator) {
        resetButtonSpectator.addEventListener('click', resetVotes);
    }
    
    // Voting cards
    var fibonacciCards = document.querySelectorAll('.fibonacci-card');
    for (var i = 0; i < fibonacciCards.length; i++) {
        fibonacciCards[i].addEventListener('click', function() {
            var value = parseInt(this.dataset.value);
            castVote(value);
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

// Connect to server - FIXED: Correct port detection
function connectToServer() {
    console.log('🔌 Connecting to server...');
    
    // FIXED: Connect to the correct backend server port
    var serverUrl = 'http://localhost:3001';  // Backend runs on 3001
    
    // Check if Socket.IO is available
    if (typeof io === 'undefined') {
        console.log('❌ Socket.IO not available');
        hideLoading();
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
            hideLoading();
            hideError();
            showTemporaryMessage('✅ Connected to server!');
        });
        
        // Connection failed
        gameState.socket.on('connect_error', function(error) {
            console.log('❌ Connection failed:', error);
            hideLoading();
            showError('Failed to connect to server. Please check if the server is running on port 3001.');
        });
        
        // Disconnect handling
        gameState.socket.on('disconnect', function() {
            console.log('❌ Disconnected from server');
            gameState.isConnected = false;
            showError('Disconnected from server');
        });
        
        // Session joined successfully
        gameState.socket.on('joinedSession', function(data) {
            console.log('🎮 Session joined successfully:', data);
            gameState.isSpectator = data.isSpectator;
            gameState.playerName = data.playerName;
            
            // Show the game interface
            showGameInterface(data);
            hideLoading();
            
            console.log('✅ Game interface should now be visible');
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
        
    } catch (error) {
        console.log('❌ Socket connection error:', error);
        hideLoading();
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
    
    // Check authentication
    var isAuthenticated = localStorage.getItem('planningPoker_authenticated') === 'true';
    if (!isAuthenticated) {
        showError('Please enter team password first');
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
    
    var canVote = !gameState.sessionState.hasConsensus;
    var isRevotingScenario = gameState.sessionState.votesRevealed && !gameState.sessionState.hasConsensus;
    
    if (!canVote) {
        console.log('🚫 Voting disabled - consensus already reached');
        showError('Consensus already reached. Spectator can reset for new voting round.');
        return;
    }
    
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
    console.log('🎮 SHOWING GAME INTERFACE - sessionData:', sessionData);
    
    // Hide join form completely
    var joinInterface = document.getElementById('joinInterface');
    if (joinInterface) {
        joinInterface.style.display = 'none';
        console.log('✅ Join interface hidden');
    }
    
    // Show game interface
    var gameInterface = document.getElementById('gameInterface');
    if (gameInterface) {
        gameInterface.style.display = 'block';
        console.log('✅ Game interface shown');
    } else {
        console.error('❌ Game interface element not found!');
        return;
    }
    
    // Update session info
    var sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
        sessionInfo.textContent = 'Session: ' + sessionData.sessionCode;
        console.log('✅ Session info updated:', sessionData.sessionCode);
    }
    
    var shareLink = document.getElementById('shareLink');
    if (shareLink) {
        var linkText = sessionData.shareUrl || ('http://localhost:8080?session=' + sessionData.sessionCode);
        shareLink.textContent = linkText;
        console.log('✅ Share link updated:', linkText);
    }
    
    // Show spectator controls if spectator
    if (sessionData.isSpectator) {
        var spectatorControls = document.getElementById('spectatorControls');
        if (spectatorControls) {
            spectatorControls.style.display = 'flex';
        }
        updateStatus('👁️ You are the Spectator. Share the link above with your team.');
        console.log('✅ Spectator mode activated');
    } else {
        updateStatus('🎯 Connected to session. Cast your vote when ready!');
        console.log('✅ Player mode activated');
    }
    
    hideLoading();
    console.log('🎉 Game interface setup complete!');
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
    
    for (var name in players) {
        if (!players.hasOwnProperty(name)) continue;
        
        var player = players[name];
        var playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        
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

function updateVotingCards() {
    var cards = document.querySelectorAll('.fibonacci-card');
    
    var canVote = !gameState.isSpectator && !gameState.sessionState.hasConsensus;
    var isReVotingScenario = gameState.sessionState.votesRevealed && !gameState.sessionState.hasConsensus;
    
    for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        card.classList.remove('disabled', 're-vote-allowed');
        
        if (canVote) {
            if (isReVotingScenario) {
                card.classList.add('re-vote-allowed');
            }
        } else {
            card.classList.add('disabled');
        }
    }
}

function updateSpectatorControls() {
    var resetButton = document.getElementById('resetButton');
    var resetButtonSpectator = document.getElementById('resetButtonSpectator');
    
    if (!gameState.isSpectator) return;
    
    var players = gameState.sessionState.players;
    var nonSpectators = [];
    
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
    
    var buttons = [resetButton, resetButtonSpectator];
    for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];
        if (!button) continue;
        
        if (hasVotes) {
            button.style.display = 'block';
            
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
    var cards = document.querySelectorAll('.fibonacci-card');
    for (var i = 0; i < cards.length; i++) {
        cards[i].classList.remove('selected');
    }
    
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
    var statusEl = document.getElementById('gameStatus');
    if (!statusEl) return;
    
    if (message) {
        statusEl.innerHTML = message;
        statusEl.className = 'status';
        return;
    }
    
    var players = gameState.sessionState.players;
    var nonSpectators = [];
    var totalVoters = 0;
    var votedCount = 0;
    
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
            statusEl.innerHTML = '<div class="no-consensus">⚠️ No consensus reached.<br><strong>You can change your vote or wait for spectator to reset.</strong></div>';
            statusEl.className = 'status no-consensus';
        }
    } else {
        statusEl.innerHTML = '📊 Voting: ' + votedCount + '/' + totalVoters + ' players voted';
        statusEl.className = 'status';
    }
}

function showTemporaryMessage(message, duration) {
    duration = duration || 3000;
    
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
            '<h3>🔒 Enter Team Password</h3>' +
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