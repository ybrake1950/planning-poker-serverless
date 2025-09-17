// Fixed Planning Poker Frontend - app.js
// Directory: Execute from project root (planning-poker/)
// Changes: 
// 1. Spectators can reset votes even after consensus
// 2. Voting members can re-cast votes when no consensus is reached
// 3. Better UI state management for re-voting scenarios

// Global game state
const gameState = {
    socket: null,
    isConnected: false,
    sessionState: {
        players: {},
        votesRevealed: false,
        hasConsensus: false
    },
    isSpectator: false
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Planning Poker app initializing...');
    setupEventListeners();
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
    // Join button
    document.getElementById('joinButton').addEventListener('click', joinSession);
    
    // Reset button (spectator only)
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetVotes);
    }
    
    // Voting cards
    document.querySelectorAll('.fibonacci-card').forEach(card => {
        card.addEventListener('click', function() {
            const value = parseInt(this.dataset.value);
            castVote(value);
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
        clearSelectedVote();
        showTemporaryMessage('Votes have been reset. You can vote again!');
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
    const isSpectator = !sessionCode; // Creator becomes spectator
    const finalSessionCode = sessionCode || generateSessionCode();
    
    console.log(`🎯 ${isSpectator ? 'Creating' : 'Joining'} session: ${finalSessionCode}`);
    
    // Send join request to server
    gameState.socket.emit('joinSession', {
        sessionCode: finalSessionCode,
        playerName,
        isSpectator
    });
}

// Cast a vote - FIXED: Allow re-voting when no consensus
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
    
    // FIXED: Allow voting if consensus not reached, even if votes are revealed
    if (gameState.sessionState.votesRevealed && gameState.sessionState.hasConsensus) {
        console.log('🚫 Voting disabled - consensus already reached');
        showError('Consensus already reached. Spectator can reset for new voting round.');
        return;
    }
    
    console.log(`🗳️ Casting vote: ${value}`);
    
    // Update UI immediately for responsiveness
    updateSelectedVote(value);
    
    // Send vote to server
    gameState.socket.emit('castVote', { vote: value });
}

// Reset votes - FIXED: Allow spectators to reset even after consensus
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
    const joinForm = document.getElementById('joinForm');
    if (joinForm) {
        joinForm.style.display = 'none';
    }
    
    // Show game interface
    const gameInterface = document.getElementById('gameInterface');
    if (gameInterface) {
        gameInterface.style.display = 'block';
    }
    
    // Update session info
    const currentSessionCode = document.getElementById('currentSessionCode');
    if (currentSessionCode) {
        currentSessionCode.textContent = sessionData.sessionCode;
    }
    
    const shareLink = document.getElementById('shareLink');
    if (shareLink) {
        shareLink.textContent = sessionData.shareUrl || `${window.location.origin}?session=${sessionData.sessionCode}`;
    }
    
    // Show spectator controls if spectator
    if (sessionData.isSpectator) {
        const spectatorControls = document.getElementById('spectatorControls');
        if (spectatorControls) {
            spectatorControls.style.display = 'flex';
        }
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
    updateSpectatorControls(); // NEW: Better spectator controls
}

function updatePlayerCards() {
    const container = document.getElementById('playerCards');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(gameState.sessionState.players).forEach(([name, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-card';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = `player-name${player.isSpectator ? ' spectator' : ''}`;
        nameDiv.textContent = `${name}${player.isSpectator ? ' (Spectator)' : ''}`;
        
        const cardDiv = document.createElement('div');
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
    });
}

// FIXED: Update voting cards to allow re-voting when no consensus
function updateVotingCards() {
    const cards = document.querySelectorAll('.fibonacci-card');
    
    // Only disable if spectator OR (votes revealed AND consensus reached)
    const shouldDisable = gameState.isSpectator || 
                         (gameState.sessionState.votesRevealed && gameState.sessionState.hasConsensus);
    
    cards.forEach(card => {
        if (shouldDisable) {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }
    });
}

// NEW: Update spectator controls based on game state
function updateSpectatorControls() {
    const resetButton = document.getElementById('resetButton');
    if (!resetButton || !gameState.isSpectator) return;
    
    const players = gameState.sessionState.players;
    const nonSpectators = Object.entries(players).filter(([_, player]) => !player.isSpectator);
    const hasVotes = nonSpectators.some(([_, player]) => player.hasVoted);
    
    // Show reset button if there are votes to reset
    if (hasVotes) {
        resetButton.style.display = 'block';
        
        // Update button text based on state
        if (gameState.sessionState.hasConsensus) {
            resetButton.textContent = '🔄 Start New Round';
        } else if (gameState.sessionState.votesRevealed) {
            resetButton.textContent = '🔄 Reset for Re-vote';
        } else {
            resetButton.textContent = '🔄 Reset Votes';
        }
    } else {
        resetButton.style.display = 'none';
    }
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

// ENHANCED: Better status messages for re-voting scenarios
function updateStatus(message) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    
    if (message) {
        statusEl.textContent = message;
        statusEl.className = 'status';
        return;
    }
    
    // Auto-generate status based on game state
    const players = gameState.sessionState.players;
    const nonSpectators = Object.entries(players).filter(([_, player]) => !player.isSpectator);
    const totalVoters = nonSpectators.length;
    const votedCount = nonSpectators.filter(([_, player]) => player.hasVoted).length;
    
    if (totalVoters === 0) {
        statusEl.textContent = 'Waiting for voters to join...';
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
            // ENHANCED: Better messaging for re-voting
            statusEl.innerHTML = `
                <div class="no-consensus">
                    ⚠️ No consensus reached. 
                    <br><strong>You can change your vote or wait for spectator to reset.</strong>
                </div>
            `;
            statusEl.className = 'status no-consensus';
        }
    } else {
        statusEl.textContent = `Voting: ${votedCount}/${totalVoters} players voted`;
        statusEl.className = 'status';
    }
}

// NEW: Show temporary messages to users
function showTemporaryMessage(message, duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        document.body.removeChild(messageDiv);
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
            showCopyFeedback('✅ Link copied to clipboard!');
        }).catch(() => {
            showCopyFeedback('❌ Unable to copy - please copy manually');
        });
    } else {
        // Fallback for older browsers
        showCopyFeedback('💡 Please copy the link manually');
    }
}

function showCopyFeedback(message) {
    const linkEl = document.getElementById('shareLink');
    if (!linkEl) return;
    
    const originalText = linkEl.textContent;
    
    linkEl.textContent = message;
    setTimeout(() => {
        linkEl.textContent = originalText;
    }, 2000);
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

// Keyboard shortcuts
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
        const voteValue = fibValues[keyNum - 1];
        castVote(voteValue);
    }
    
    // 'R' key for reset (Spectator only)
    //if (event.key.toLowerCase() === 'r' && gameState.isSpectator) {
    //    resetVotes();
    //}
});