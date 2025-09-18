// Enhanced Planning Poker Frontend - app.js
// Directory: Execute from client/src/ folder
// Incorporates Enhancement 1, 2, and 3 from UI Enhancement Mockups:
// - Enhancement 1: Improved Re-voting Interface with dynamic vote changing
// - Enhancement 2: Smart Spectator Controls with context-aware reset button
// - Enhancement 3: Enhanced Player Status Indicators with visual feedback

// Global game state
const gameState = {
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
    checkAuthentication(); // Check if user needs to authenticate
    connectToServer();
    
    // Check URL parameters for session joining
    const urlParams = new URLSearchParams(window.location.search);
    const sessionCode = urlParams.get('session');
    if (sessionCode) {
        document.getElementById('sessionCode').value = sessionCode;
    }
});

// Setup event listeners
function setupEventListeners() {
    // Team password authentication
    const teamPasswordField = document.getElementById('teamPassword');
    if (teamPasswordField) {
        teamPasswordField.addEventListener('click', handlePasswordAuth);
        teamPasswordField.addEventListener('focus', handlePasswordAuth);
    }
    
    // Join button
    document.getElementById('joinButton').addEventListener('click', joinSession);
    
    // Reset buttons (both main and spectator)
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetVotes);
    }
    
    const resetButtonSpectator = document.getElementById('resetButtonSpectator');
    if (resetButtonSpectator) {
        resetButtonSpectator.addEventListener('click', resetVotes);
    }
    
    // Voting cards with enhanced interaction
    document.querySelectorAll('.fibonacci-card').forEach(card => {
        card.addEventListener('click', function() {
            const value = parseInt(this.dataset.value);
            castVote(value);
        });
        
        // Keyboard support
        card.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const value = parseInt(this.dataset.value);
                castVote(value);
            }
        });
    });
    
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
    const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3001' 
        : window.location.origin;
    
    gameState.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true
    });
    
    // Connection established
    gameState.socket.on('connect', () => {
        console.log('✅ Connected to server');
        gameState.isConnected = true;
        hideError();
        hideLoading();
    });
    
    // Connection failed
    gameState.socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        gameState.isConnected = false;
        showError('Connection lost. Trying to reconnect...');
    });
    
    // Session joined successfully
    gameState.socket.on('sessionJoined', (data) => {
        console.log('🎮 Session joined:', data);
        gameState.isSpectator = data.isSpectator;
        gameState.playerName = data.playerName;
        showGameInterface(data);
        updateGameInterface();
    });
    
    // Session state update
    gameState.socket.on('sessionUpdate', (data) => {
        console.log('📊 Session update received:', data);
        
        if (data.state) {
            gameState.sessionState = {
                ...gameState.sessionState,
                ...data.state
            };
            updateGameInterface();
        }
    });
    
    // Votes reset notification
    gameState.socket.on('votesReset', () => {
        console.log('🔄 Votes have been reset');
        gameState.currentVote = null;
        clearSelectedVote();
        showTemporaryMessage('🔄 Votes reset - you can vote again!');
    });
    
    // Error handling
    gameState.socket.on('error', (data) => {
        console.error('❌ Server error:', data);
        showError(data.message || 'Server error occurred');
        hideLoading();
    });
}

// Join or create session
function joinSession() {
    const playerName = document.getElementById('playerName').value.trim();
    const sessionCode = document.getElementById('sessionCode').value.trim();
    const isSpectator = document.getElementById('spectatorMode').checked;
    
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
    const finalSessionCode = sessionCode || generateSessionCode();
    
    console.log(`🎯 ${sessionCode ? 'Joining' : 'Creating'} session: ${finalSessionCode} as ${isSpectator ? 'Spectator' : 'Player'}`);
    
    // Send join request to server
    gameState.socket.emit('joinSession', {
        sessionCode: finalSessionCode,
        playerName,
        isSpectator
    });
}

// ENHANCEMENT 1: Cast a vote with dynamic vote changing support
function castVote(value) {
    console.log(`🗳️ Vote button clicked: ${value}`);
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (gameState.isSpectator) {
        showError('Spectators cannot vote');
        return;
    }
    
    // ENHANCEMENT 1: Allow re-voting when no consensus, even if votes are revealed
    const canVote = !gameState.sessionState.hasConsensus;
    const isRevotingScenario = gameState.sessionState.votesRevealed && !gameState.sessionState.hasConsensus;
    
    if (!canVote) {
        console.log('🚫 Voting disabled - consensus already reached');
        showError('Consensus already reached. Spectator can reset for new voting round.');
        return;
    }
    
    // Show appropriate feedback for re-voting
    if (isRevotingScenario && gameState.currentVote !== null) {
        showTemporaryMessage(`🔄 Vote changed from ${gameState.currentVote} to ${value}`);
    } else if (isRevotingScenario) {
        showTemporaryMessage(`🗳️ Vote cast: ${value} (re-voting round)`);
    } else {
        showTemporaryMessage(`✅ Vote recorded: ${value}`);
    }
    
    console.log(`🗳️ Casting vote: ${value}${isRevotingScenario ? ' (re-voting)' : ''}`);
    
    // Update local state and UI immediately for responsiveness
    gameState.currentVote = value;
    updateSelectedVote(value);
    
    // Add visual feedback for re-voting scenario
    if (isRevotingScenario) {
        addReVotingVisualFeedback();
    }
    
    // Send vote to server
    gameState.socket.emit('castVote', { vote: value });
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
    const players = gameState.sessionState.players;
    const nonSpectators = Object.entries(players).filter(([_, player]) => !player.isSpectator);
    const hasVotes = nonSpectators.some(([_, player]) => player.hasVoted);
    
    if (!hasVotes) {
        showTemporaryMessage('ℹ️ No votes to reset');
        return;
    }
    
    let actionMessage = '';
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
        votedCount: nonSpectators.filter(([_, player]) => player.hasVoted).length
    });
    
    gameState.socket.emit('resetVotes');
}

// UI Helper Functions
function showGameInterface(sessionData) {
    console.log('🎮 Showing game interface:', sessionData);
    
    // Hide join form
    const joinForm = document.getElementById('joinInterface');
    if (joinForm) {
        joinForm.style.display = 'none';
    }
    
    // Show game interface
    const gameInterface = document.getElementById('gameInterface');
    if (gameInterface) {
        gameInterface.style.display = 'block';
    }
    
    // Update session info
    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
        sessionInfo.textContent = `Session: ${sessionData.sessionCode}`;
    }
    
    const shareLink = document.getElementById('shareLink');
    if (shareLink) {
        shareLink.textContent = sessionData.shareUrl || `${window.location.origin}?session=${sessionData.sessionCode}`;
    }
    
    // ENHANCEMENT 2: Show spectator controls if spectator
    if (sessionData.isSpectator) {
        const spectatorControls = document.getElementById('spectatorControls');
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
    const container = document.getElementById('playerCards');
    if (!container) return;
    
    container.innerHTML = '';
    
    const players = gameState.sessionState.players;
    const votesRevealed = gameState.sessionState.votesRevealed;
    
    Object.entries(players).forEach(([name, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        
        // ENHANCEMENT 3: Add visual state indicators
        if (!player.isSpectator) {
            if (player.hasVoted) {
                playerDiv.classList.add('has-voted');
            } else if (!votesRevealed || !gameState.sessionState.hasConsensus) {
                playerDiv.classList.add('needs-vote');
            }
        }
        
        const nameDiv = document.createElement('div');
        nameDiv.className = `player-name${player.isSpectator ? ' spectator' : ''}`;
        nameDiv.textContent = `${name}${player.isSpectator ? ' (Spectator)' : ''}`;
        
        const cardDiv = document.createElement('div');
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
        const statusDiv = document.createElement('small');
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
    });
}

// ENHANCEMENT 1: Enhanced voting cards with re-voting support
function updateVotingCards() {
    const cards = document.querySelectorAll('.fibonacci-card');
    
    const canVote = !gameState.isSpectator && !gameState.sessionState.hasConsensus;
    const isReVotingScenario = gameState.sessionState.votesRevealed && !gameState.sessionState.hasConsensus;
    
    cards.forEach(card => {
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
    });
}

// ENHANCEMENT 2: Context-aware spectator controls
function updateSpectatorControls() {
    const resetButton = document.getElementById('resetButton');
    const resetButtonSpectator = document.getElementById('resetButtonSpectator');
    
    if (!gameState.isSpectator) return;
    
    const players = gameState.sessionState.players;
    const nonSpectators = Object.entries(players).filter(([_, player]) => !player.isSpectator);
    const hasVotes = nonSpectators.some(([_, player]) => player.hasVoted);
    
    // Show/hide reset buttons based on votes
    [resetButton, resetButtonSpectator].forEach(button => {
        if (!button) return;
        
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
    });
}

function updateSelectedVote(value) {
    // Clear previous selection
    document.querySelectorAll('.fibonacci-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Select new vote
    if (value) {
        const selectedCard = document.querySelector(`[data-value="${value}"]`);
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
    const statusEl = document.getElementById('gameStatus');
    if (!statusEl) return;
    
    if (message) {
        statusEl.innerHTML = message;
        statusEl.className = 'status';
        return;
    }
    
    // Auto-generate status based on game state
    const players = gameState.sessionState.players;
    const nonSpectators = Object.entries(players).filter(([_, player]) => !player.isSpectator);
    const totalVoters = nonSpectators.length;
    const votedCount = nonSpectators.filter(([_, player]) => player.hasVoted).length;
    
    if (totalVoters === 0) {
        statusEl.innerHTML = '⏳ Waiting for voters to join...';
        statusEl.className = 'status';
    } else if (gameState.sessionState.votesRevealed) {
        if (gameState.sessionState.hasConsensus) {
            const consensusVote = nonSpectators.find(([_, player]) => player.hasVoted)?.[1]?.vote;
            statusEl.innerHTML = `
                <div class="consensus">
                    🎉 Consensus Reached! Story Points: ${consensusVote} 🎉
                </div>
            `;
        } else {
            // ENHANCEMENT 1: Enhanced messaging for re-voting
            statusEl.innerHTML = `
                <div class="no-consensus">
                    ⚠️ No consensus reached.<br>
                    <strong>You can change your vote or wait for spectator to reset.</strong>
                </div>
            `;
            statusEl.className = 'status no-consensus';
        }
    } else {
        statusEl.innerHTML = `📊 Voting: ${votedCount}/${totalVoters} players voted`;
        statusEl.className = 'status';
    }
}

// ENHANCEMENT 1: Visual feedback for re-voting
function addReVotingVisualFeedback() {
    const cards = document.querySelectorAll('.fibonacci-card');
    cards.forEach(card => {
        card.style.animation = 'gentle-pulse 1s ease-in-out';
        setTimeout(() => {
            card.style.animation = '';
        }, 1000);
    });
}

// Enhanced temporary message system
function showTemporaryMessage(message, duration = 3000) {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.temporary-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
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
    const shareLink = document.getElementById('shareLink');
    if (!shareLink) return;
    
    const shareLinkText = shareLink.textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareLinkText).then(() => {
            showTemporaryMessage('✅ Link copied to clipboard!');
        }).catch(() => {
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
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(hideError, 5000);
    }
}

function hideError() {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

function showLoading() {
    const loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
        loadingEl.style.display = 'block';
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loadingState');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// Enhanced keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Only handle shortcuts when in game interface
    const gameInterface = document.getElementById('gameInterface');
    if (!gameInterface || gameInterface.style.display === 'none') {
        return;
    }
    
    // Number keys 1-6 for Fibonacci votes
    const fibValues = [1, 2, 3, 5, 8, 13];
    const keyNum = event.key ? parseInt(event.key) : null;
    
    if (keyNum >= 1 && keyNum <= 6) {
        event.preventDefault();
        const voteValue = fibValues[keyNum - 1];
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
    const isAuthenticated = localStorage.getItem('planningPoker_authenticated') === 'true';
    
    if (isAuthenticated) {
        hidePasswordField();
        focusOnPlayerName();
    } else {
        showPasswordField();
    }
}

function handlePasswordAuth() {
    const passwordField = document.getElementById('teamPassword');
    const correctPassword = '••••••••••'; // This is the masked display
    
    // Create password input modal
    showPasswordModal();
}

function showPasswordModal() {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'password-modal-overlay';
    modalOverlay.innerHTML = `
        <div class="password-modal">
            <h3>🔐 Enter Team Password</h3>
            <p>Please enter the team password to access Planning Poker:</p>
            <input type="password" id="passwordInput" placeholder="Enter password" maxlength="50">
            <div class="modal-buttons">
                <button id="submitPassword" class="btn-primary">Submit</button>
                <button id="cancelPassword" class="btn-secondary">Cancel</button>
            </div>
            <div id="passwordError" class="password-error" style="display: none;"></div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Focus on password input
    const passwordInput = document.getElementById('passwordInput');
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
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closePasswordModal();
        }
    });
}

function validatePassword() {
    const passwordInput = document.getElementById('passwordInput');
    const enteredPassword = passwordInput.value.trim();
    const passwordError = document.getElementById('passwordError');
    
    // You can customize this password or make it configurable
    const correctPassword = 'team2024'; // Change this to your desired password
    
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
        const modal = document.querySelector('.password-modal');
        modal.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            modal.style.animation = '';
        }, 500);
    }
}

function closePasswordModal() {
    const modal = document.querySelector('.password-modal-overlay');
    if (modal) {
        modal.remove();
    }
}

function hidePasswordField() {
    const passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'none';
    }
}

function showPasswordField() {
    const passwordGroup = document.getElementById('passwordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = 'block';
    }
}

function focusOnPlayerName() {
    // Focus on player name field after authentication
    setTimeout(() => {
        const playerNameField = document.getElementById('playerName');
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