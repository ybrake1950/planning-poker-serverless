// client/src/app.js
// Fixed Frontend application logic for Planning Poker

console.log('🚀 Planning Poker client starting...');

// Application state
let gameState = {
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
    console.log('📋 DOM loaded, setting up event listeners...');
    setupEventListeners();
    initializeApp();
});

function setupEventListeners() {
    console.log('🔗 Setting up event listeners...');
    
    // Join button
    const joinButton = document.querySelector('#joinButton');
    if (joinButton) {
        joinButton.addEventListener('click', joinSession);
        console.log('✅ Join button listener added');
    }
    
    // Join form submission
    const joinForm = document.querySelector('#joinForm');
    if (joinForm) {
        // Handle form submission with Enter key
        const inputs = joinForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    joinSession();
                }
            });
        });
    }
    
    // Set up voting card clicks
    document.querySelectorAll('.fibonacci-card').forEach(card => {
        card.addEventListener('click', function() {
            const value = parseInt(this.getAttribute('data-value'));
            castVote(value);
        });
    });
    
    // Set up reset button
    const resetButton = document.querySelector('#resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetVotes);
    }
    
    // Set up copy link functionality
    const shareLink = document.querySelector('#shareLink');
    if (shareLink) {
        shareLink.addEventListener('click', copyShareLink);
    }
    
    console.log('✅ Event listeners set up successfully');
}

function initializeApp() {
    console.log('🔧 Initializing Planning Poker app...');
    
    // Check for session code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('session');
    if (sessionFromUrl) {
        const sessionCodeInput = document.getElementById('sessionCode');
        if (sessionCodeInput) {
            sessionCodeInput.value = sessionFromUrl.toUpperCase();
            console.log('🔗 Pre-filled session code from URL:', sessionFromUrl);
        }
    }
    
    // Initialize socket connection
    initializeSocket();
    
    console.log('✅ Planning Poker app initialized');
}

function initializeSocket() {
    // Connect to local development server
    const serverUrl = 'http://localhost:3001';
    
    console.log('🔌 Connecting to Socket.IO server...');
    gameState.socket = io(serverUrl);
    
    // Connection event handlers
    gameState.socket.on('connect', () => {
        console.log('✅ Connected to server:', gameState.socket.id);
        gameState.isConnected = true;
        hideError();
        hideLoading();
    });
    
    gameState.socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
        gameState.isConnected = false;
        showError('Connection lost. Trying to reconnect...');
        showLoading();
    });
    
    gameState.socket.on('connect_error', (error) => {
        console.error('🔥 Connection error:', error);
        showError('Unable to connect to server. Please refresh the page.');
    });
    
    // Game event handlers
    gameState.socket.on('joinedSession', (data) => {
        console.log('🎮 Joined session successfully:', data);
        
        gameState.sessionCode = data.sessionCode;
        gameState.playerName = data.playerName;
        gameState.isSpectator = data.isSpectator;
        
        // Update URL without page reload
        const newUrl = `${window.location.origin}${window.location.pathname}?session=${data.sessionCode}`;
        window.history.pushState({}, '', newUrl);
        
        // Show game interface
        showGameInterface(data);
    });
    
    gameState.socket.on('sessionUpdate', (data) => {
        console.log('📊 Session updated:', data);
        gameState.sessionState = data.state;
        updateGameInterface();
    });
    
    gameState.socket.on('votesReset', () => {
        console.log('🔄 Votes reset');
        clearSelectedVote();
        updateStatus('New voting round started. Cast your votes!');
    });
    
    gameState.socket.on('sessionEnded', (data) => {
        console.log('🚪 Session ended:', data);
        showError(data.message || 'Session has ended');
        setTimeout(() => {
            window.location.reload();
        }, 3000);
    });
    
    gameState.socket.on('error', (data) => {
        console.error('⚠️ Server error:', data);
        showError(data.message || 'An error occurred');
    });
}

// Join or create session
function joinSession() {
    console.log('🎯 Join session button clicked');
    
    const playerNameInput = document.getElementById('playerName');
    const sessionCodeInput = document.getElementById('sessionCode');
    
    if (!playerNameInput || !sessionCodeInput) {
        showError('Form elements not found. Please refresh the page.');
        return;
    }
    
    const playerName = playerNameInput.value.trim();
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();
    
    console.log('📝 Form data:', { playerName, sessionCode });
    
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

// Cast a vote
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
    
    if (gameState.sessionState.votesRevealed && gameState.sessionState.hasConsensus) {
        console.log('🚫 Voting disabled - consensus already reached');
        return; // Don't allow voting after consensus
    }
    
    console.log(`🗳️ Casting vote: ${value}`);
    
    // Update UI immediately for responsiveness
    updateSelectedVote(value);
    
    // Send vote to server
    gameState.socket.emit('castVote', { vote: value });
}

// Reset votes (Spectator only)
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
        shareLink.textContent = sessionData.shareUrl || `http://localhost:8080?session=${sessionData.sessionCode}`;
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

function updateVotingCards() {
    const cards = document.querySelectorAll('.fibonacci-card');
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
            statusEl.textContent = 'No consensus reached. Spectator can reset for re-vote.';
            statusEl.className = 'status';
        }
    } else {
        statusEl.textContent = `Voting: ${votedCount}/${totalVoters} players voted`;
        statusEl.className = 'status';
    }
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

// Error and Loading States - Fixed with null checks
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
        castVote(fibValues[keyNum - 1]);
    }
    
    // R for reset (spectator only)
    if (event.key && event.key.toLowerCase() === 'r' && gameState.isSpectator) {
        resetVotes();
    }
});

// Handle browser back/forward
window.addEventListener('popstate', function(event) {
    // Refresh page if user navigates back/forward
    window.location.reload();
});

// Make functions globally available - MOVED TO END
window.joinSession = joinSession;
window.castVote = castVote;
window.resetVotes = resetVotes;
window.copyShareLink = copyShareLink;

console.log('📱 Planning Poker client loaded successfully');