// client/src/app.js
// Complete Planning Poker Frontend - No Duplicate Functions
// Directory: planning-poker-serverless/client/src/app.js

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
    sessionCode: '',
    currentVote: null
};
// Debug helper functions (add these to your global scope)
window.debugApp = function() {
    debugCurrentState();
};

window.testAuth = function() {
    console.log('🧪 Testing authentication...');
    forceShowPasswordInterface();
};

window.testSuccess = function() {
    showSuccess('Test success message!');
};

window.testError = function() {
    showError('Test error message!');
};

window.validateElements = function() {
    return validateRequiredElements();
};
// Updated initialization to ensure proper flow
function initializeAuthentication() {
    console.log('🔄 Initializing authentication flow...');
    
    // Always start with authentication check
    checkAuthentication();
    
    // Add some debugging after a short delay
    setTimeout(function() {
        var passwordSection = document.getElementById('passwordSection');
        var gameSection = document.getElementById('gameSection');
        
        if (passwordSection) {
            var passwordDisplay = window.getComputedStyle(passwordSection).display;
            console.log('🔍 Password section display:', passwordDisplay);
        } else {
            console.error('❌ Password section not found!');
        }
        
        if (gameSection) {
            var gameDisplay = window.getComputedStyle(gameSection).display;
            console.log('🔍 Game section display:', gameDisplay);
        } else {
            console.error('❌ Game section not found!');
        }
    }, 100);
}
// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Planning Poker app starting...');
    
    // Use safe initialization to prevent errors
    try {
        safeInitialize();
    } catch (error) {
        console.error('❌ Critical initialization error:', error);
        
        // Show error on page
        var body = document.body;
        if (body) {
            var errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
                <div style="background: #f44336; color: white; padding: 20px; margin: 20px; border-radius: 8px;">
                    <h3>⚠️ App Initialization Error</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Solution:</strong> Please refresh the page or check the console for details.</p>
                    <button onclick="location.reload()" style="background: white; color: #f44336; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                        🔄 Refresh Page
                    </button>
                </div>
            `;
            body.insertBefore(errorDiv, body.firstChild);
        }
    }
});

// Setup event listeners
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Team password button
    var teamPasswordBtn = document.getElementById('teamPasswordBtn');
    if (teamPasswordBtn) {
        teamPasswordBtn.addEventListener('click', handlePasswordAuth);
        console.log('✅ Password button listener added');
    } else {
        console.warn('⚠️ Password button not found');
    }
    
    // Password input enter key
    var teamPasswordInput = document.getElementById('teamPassword');
    if (teamPasswordInput) {
        teamPasswordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handlePasswordAuth();
            }
        });
        console.log('✅ Password input enter key listener added');
    }
    
    // Join button
    var joinButton = document.getElementById('joinButton');
    if (joinButton) {
        joinButton.addEventListener('click', joinSession);
        console.log('✅ Join button listener added');
    } else {
        console.warn('⚠️ Join button not found');
    }
    
    // Reset buttons
    var resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', resetVotes);
        console.log('✅ Reset button listener added');
    }
    
    var resetButtonSpectator = document.getElementById('resetButtonSpectator');
    if (resetButtonSpectator) {
        resetButtonSpectator.addEventListener('click', resetVotes);
        console.log('✅ Spectator reset button listener added');
    }
    
    // Voting cards
    var fibonacciCards = document.querySelectorAll('.fibonacci-card');
    if (fibonacciCards.length > 0) {
        for (var i = 0; i < fibonacciCards.length; i++) {
            fibonacciCards[i].addEventListener('click', function() {
                var value = parseInt(this.dataset.value);
                castVote(value);
            });
        }
        console.log('✅ Voting card listeners added (' + fibonacciCards.length + ' cards)');
    } else {
        console.warn('⚠️ No voting cards found');
    }
    
    // Share link copy functionality
    var shareLink = document.getElementById('shareLink');
    if (shareLink) {
        shareLink.addEventListener('click', copyShareLink);
        console.log('✅ Share link listener added');
    } else {
        console.warn('⚠️ Share link button not found');
    }
    
    // Enter key to join
    var playerNameInput = document.getElementById('playerName');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinSession();
            }
        });
        console.log('✅ Player name enter key listener added');
    }
    
    console.log('🎯 Event listeners setup complete');
}
// Global error handler to catch any missed errors
window.addEventListener('error', function(event) {
    console.error('🚨 Global error caught:', event.error);
    console.error('  - Message:', event.message);
    console.error('  - Filename:', event.filename);
    console.error('  - Line:', event.lineno);
    console.error('  - Column:', event.colno);
    
    // Try to show error message to user
    try {
        showError('An unexpected error occurred. Please refresh the page.');
    } catch (e) {
        console.error('❌ Could not show error message:', e);
    }
});
// Authentication functions
function checkAuthentication() {
    console.log('🔐 Checking authentication...');
    
    // FORCE PRODUCTION BEHAVIOR (for testing)
    // Comment out the localhost bypass to test password authentication
    var isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    // UNCOMMENT THIS LINE TO TEST PRODUCTION BEHAVIOR:
    var forceProductionAuth = true; // Set to true to test password auth
    
    if (isLocalhost && !forceProductionAuth) {
        console.log('🏠 Local development - skipping password auth');
        showGameInterface();
        return;
    }
    
    // For production (or forced production testing), always require password
    var authenticated = localStorage.getItem('planning-poker-authenticated');
    
    if (authenticated === 'true') {
        console.log('✅ User is authenticated from localStorage');
        showGameInterface();
    } else {
        console.log('🔒 User needs to authenticate - showing password interface');
        showPasswordInterface();
    }
}
// Enhanced error handling for missing elements
function validateRequiredElements() {
    console.log('🔍 Validating required HTML elements...');
    
    var requiredElements = [
        'passwordSection',
        'gameSection', 
        'teamPassword',
        'teamPasswordBtn',
        'joinForm',
        'sessionInterface',
        'playerName',
        'joinButton',
        'shareLink',
        'loading',
        'error',
        'connectionStatus'
    ];
    
    var missingElements = [];
    
    requiredElements.forEach(function(id) {
        var element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('❌ Missing required elements:', missingElements);
        return false;
    } else {
        console.log('✅ All required elements found');
        return true;
    }
}
function handlePasswordAuth() {
    console.log('🔑 Handling password authentication...');
    
    var passwordInput = document.getElementById('teamPassword');
    if (!passwordInput) {
        console.error('❌ Password input not found');
        showError('Password input not found');
        return;
    }
    
    var password = passwordInput.value.trim();
    
    // Validate password
    if (password.length === 0) {
        showError('Please enter a password');
        return;
    }
    
    // For demo purposes, accept any non-empty password
    // In production, you would validate against a real password
    console.log('🔍 Validating password...');
    
    // Simulate password validation
    if (password.length > 0) {
        // Store authentication state
        localStorage.setItem('planning-poker-authenticated', 'true');
        console.log('✅ Password authentication successful');
        
        // Clear any error messages
        hideError();
        
        // Show success message briefly
        showSuccess('Authentication successful!');
        
        // Transition to game interface
        setTimeout(function() {
            showGameInterface();
        }, 500);
        
    } else {
        console.log('❌ Invalid password');
        showError('Invalid password. Please try again.');
    }
}
// Initialize everything safely
function safeInitialize() {
    console.log('🔒 Safe initialization starting...');
    
    try {
        // Validate elements first
        if (!validateRequiredElements()) {
            console.error('❌ Required elements missing - check your HTML');
            return;
        }
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize authentication
        initializeAuthentication();
        
        // Connect to server
        connectToServer();
        
        // Handle URL parameters
        var urlParams = new URLSearchParams(window.location.search);
        var sessionCode = urlParams.get('session');
        if (sessionCode) {
            var sessionInput = document.getElementById('sessionCode');
            if (sessionInput) {
                sessionInput.value = sessionCode;
                console.log('🔗 Session code from URL:', sessionCode);
            }
        }
        
        console.log('✅ Safe initialization complete');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        showError('App initialization failed: ' + error.message);
    }
}
function showPasswordInterface() {
    console.log('🔒 Showing password interface');
    
    var passwordSection = document.getElementById('passwordSection');
    var gameSection = document.getElementById('gameSection');
    
    if (passwordSection) {
        passwordSection.style.display = 'block';
        console.log('✅ Password section shown');
    } else {
        console.error('❌ Password section element not found!');
    }
    
    if (gameSection) {
        gameSection.style.display = 'none';
        console.log('✅ Game section hidden');
    }
}

function showGameInterface() {
console.log('🎮 Showing game interface');
    
    var passwordSection = document.getElementById('passwordSection');
    var gameSection = document.getElementById('gameSection');
    
    if (passwordSection) {
        passwordSection.style.display = 'none';
        console.log('✅ Password section hidden');
    }
    
    if (gameSection) {
        gameSection.style.display = 'block';
        console.log('✅ Game section shown');
    } else {
        console.error('❌ Game section element not found!');
    }
    
    // Make sure join form is visible initially
    var joinForm = document.getElementById('joinForm');
    if (joinForm) {
        joinForm.style.display = 'block';
        console.log('✅ Join form shown');
    }
}

// Connection functions
function connectToServer() {
    console.log('🔌 Connecting to server...');
    
    var isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1';
    
    var serverUrl;
    if (isLocal) {
        serverUrl = 'http://localhost:3001';
        console.log('🏠 Using local development server:', serverUrl);
    } else {
        serverUrl = "https://eo6hf7a1wj.execute-api.us-east-1.amazonaws.com/prod";
        console.log('☁️ Using production server:', serverUrl);
    }
    
    // Initialize Socket.IO connection
    gameState.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5
    });
    
    setupSocketEventHandlers();
}

function setupSocketEventHandlers() {
    console.log('📡 Setting up socket event handlers...');
    
    gameState.socket.on('connect', function() {
        console.log('✅ Connected to backend server');
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
        showError('Unable to connect to server. Please check your connection.');
        updateConnectionStatus('Connection failed');
    });
    
    gameState.socket.on('joinedSession', function(data) {
        console.log('🎉 Successfully joined session:', data);
        gameState.sessionCode = data.sessionCode;
        gameState.playerName = data.playerName;
        gameState.isSpectator = data.isSpectator;
        
        hideLoading();
        hideError();
        showSessionInterface(data);
    });
    
    gameState.socket.on('sessionUpdate', function(data) {
        console.log('📊 Session update received:', data);
        updateSessionInterface(data);
    });
    
    gameState.socket.on('voteSubmitted', function(data) {
        console.log('🗳️ Vote submitted:', data);
        gameState.currentVote = data.vote;
        updateVotingInterface(data);
    });
    
    gameState.socket.on('votesReset', function() {
        console.log('🔄 Votes have been reset');
        gameState.currentVote = null;
        resetVotingInterface();
    });
    
    gameState.socket.on('error', function(data) {
        console.error('⚠️ Server error:', data);
        showError(data.message || 'An error occurred');
    });
}

// Game functions
function joinSession() {
    console.log('🎯 Attempting to join session...');
    
    var playerNameInput = document.getElementById('playerName');
    var sessionCodeInput = document.getElementById('sessionCode');
    var isSpectatorInput = document.getElementById('isSpectator');
    
    if (!playerNameInput) {
        showError('Player name input not found');
        return;
    }
    
    var playerName = playerNameInput.value.trim();
    var sessionCode = sessionCodeInput ? sessionCodeInput.value.trim().toUpperCase() : '';
    var isSpectator = isSpectatorInput ? isSpectatorInput.checked : false;
    
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
    
    // Send join request to server
    gameState.socket.emit('joinSession', {
        sessionCode: sessionCode,
        playerName: playerName,
        isSpectator: isSpectator
    });
}

function castVote(voteValue) {
    console.log('🗳️ Casting vote:', voteValue);
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (gameState.isSpectator) {
        showError('Spectators cannot vote');
        return;
    }
    
    gameState.socket.emit('castVote', {
        vote: voteValue
    });
}

function resetVotes() {
    console.log('🔄 Requesting vote reset...');
    
    if (!gameState.isConnected) {
        showError('Not connected to server');
        return;
    }
    
    if (!gameState.isSpectator) {
        showError('Only spectators can reset votes');
        return;
    }
    
    gameState.socket.emit('resetVotes', {});
}

// UI functions
function showLoading(message) {
    console.log('⏳ Loading:', message);
    
    var loadingElement = document.getElementById('loading');
    var errorElement = document.getElementById('error');
    
    if (loadingElement) {
        loadingElement.textContent = message || 'Loading...';
        loadingElement.style.display = 'block';
    }
    
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function hideLoading() {
    console.log('✅ Hiding loading indicator');
    
    var loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function showError(message) {
    console.error('❌ Error:', message);
    
    var errorElement = document.getElementById('error');
    var loadingElement = document.getElementById('loading');
    
    if (errorElement) {
        errorElement.textContent = message || 'An error occurred';
        errorElement.style.display = 'block';
    }
    
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

function hideError() {
    console.log('✅ Hiding error message');
    
    var errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function updateConnectionStatus(status) {
    console.log('📡 Connection status:', status);
    
    var statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
        
        // Update styling based on connection state
        if (status.includes('Connected')) {
            statusElement.className = 'status-connected';
        } else if (status.includes('Disconnected')) {
            statusElement.className = 'status-disconnected';
        } else {
            statusElement.className = 'status-connecting';
        }
    }
}

function showSessionInterface(data) {
    console.log('🎮 Showing session interface for:', data.isSpectator ? 'Spectator' : 'Voter');
    console.log('📊 Session data:', data);
    
    // Hide join form
    var joinForm = document.getElementById('joinForm');
    if (joinForm) {
        joinForm.style.display = 'none';
        console.log('✅ Join form hidden');
    }
    
    // Show session interface
    var sessionInterface = document.getElementById('sessionInterface');
    if (sessionInterface) {
        sessionInterface.style.display = 'block';
        console.log('✅ Session interface shown');
    } else {
        console.error('❌ Session interface element not found!');
    }
    
    // Update session info
    var sessionCodeElement = document.getElementById('currentSessionCode');
    var playerNameElement = document.getElementById('currentPlayerName');
    
    if (sessionCodeElement) {
        sessionCodeElement.textContent = data.sessionCode;
        console.log('✅ Session code updated:', data.sessionCode);
    }
    
    if (playerNameElement) {
        var displayName = data.playerName + (data.isSpectator ? ' (Spectator)' : ' (Voter)');
        playerNameElement.textContent = displayName;
        console.log('✅ Player name updated:', displayName);
    }
    
    // Configure interface based on role
    configureRoleBasedInterface(data.isSpectator);
    
    console.log('🎯 Session interface setup complete!');
}
    // Configure interface based on role
function configureRoleBasedInterface(isSpectator) {
   console.log('🔧 Configuring interface for:', isSpectator ? 'Spectator' : 'Voter');
    
    var votingCards = document.getElementById('votingCards');
    var resetButton = document.getElementById('resetButton');
    var resetButtonSpectator = document.getElementById('resetButtonSpectator');
    
    if (isSpectator) {
        console.log('👀 Setting up SPECTATOR interface...');
        
        // HIDE voting cards for Spectators
        if (votingCards) {
            votingCards.style.display = 'none';
            console.log('✅ Voting cards HIDDEN for spectator');
        }
        
        // SHOW spectator reset button
        if (resetButtonSpectator) {
            resetButtonSpectator.style.display = 'inline-block';
            console.log('✅ Spectator reset button SHOWN');
        }
        
        // HIDE voter reset button
        if (resetButton) {
            resetButton.style.display = 'none';
            console.log('✅ Voter reset button HIDDEN');
        }
        
    } else {
        console.log('🗳️ Setting up VOTER interface...');
        
        // SHOW voting cards for Voters
        if (votingCards) {
            votingCards.style.display = 'block';
            votingCards.style.opacity = '1';
            votingCards.style.pointerEvents = 'auto';
            console.log('✅ Voting cards SHOWN for voter');
        }
        
        // HIDE both reset buttons for Voters
        if (resetButton) {
            resetButton.style.display = 'none';
            console.log('✅ Voter reset button HIDDEN');
        }
        
        if (resetButtonSpectator) {
            resetButtonSpectator.style.display = 'none';
            console.log('✅ Spectator reset button HIDDEN');
        }
    }
}

function updateSessionInterface(data) {
    console.log('📊 Updating session interface:', data);
    
    if (data.state) {
        gameState.sessionState = data.state;
        updatePlayersDisplay(data.state.players);
        updateVotingDisplay(data.state.votesRevealed, data.state.hasConsensus);
    }
}

function updatePlayersDisplay(players) {
    var playersListElement = document.getElementById('playersList');
    if (!playersListElement) return;
    
    var html = '';
    for (var playerName in players) {
        if (players.hasOwnProperty(playerName)) {
            var player = players[playerName];
            var status = player.isSpectator ? 'Spectator' : 
                        (player.hasVoted ? '✓ Voted' : '⏳ Waiting');
            var vote = (player.vote && gameState.sessionState.votesRevealed) ? 
                      (' - Vote: ' + player.vote) : '';
            
            html += '<div class="player-item">' + playerName + ' (' + status + ')' + vote + '</div>';
        }
    }
    
    playersListElement.innerHTML = html;
}

function updateVotingDisplay(votesRevealed, hasConsensus) {
    var votingCards = document.querySelectorAll('.fibonacci-card');
    
    // Update card selection state
    for (var i = 0; i < votingCards.length; i++) {
        var card = votingCards[i];
        var cardValue = parseInt(card.dataset.value);
        
        if (cardValue === gameState.currentVote) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }
    
    // Show consensus message if reached
    if (hasConsensus) {
        showSuccess('🎯 Consensus reached!');
    }
}

function updateVotingInterface(data) {
    gameState.currentVote = data.vote;
    updateVotingDisplay(gameState.sessionState.votesRevealed, gameState.sessionState.hasConsensus);
}

function resetVotingInterface() {
    gameState.currentVote = null;
    var votingCards = document.querySelectorAll('.fibonacci-card');
    
    for (var i = 0; i < votingCards.length; i++) {
        votingCards[i].classList.remove('selected');
    }
}

function copyShareLink() {
        console.log('📋 Copying share link...');
    
    if (!gameState.sessionCode) {
        showError('No active session to share');
        return;
    }
    
    var shareUrl = window.location.origin + window.location.pathname + '?session=' + gameState.sessionCode;
    console.log('🔗 Share URL:', shareUrl);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(function() {
            showSuccess('Share link copied to clipboard!');
        }).catch(function(err) {
            console.error('Failed to copy link:', err);
            fallbackCopyShareLink(shareUrl);
        });
    } else {
        fallbackCopyShareLink(shareUrl);
    }
}
// Fallback copy function for older browsers
function fallbackCopyShareLink(shareUrl) {
    console.log('📋 Using fallback copy method...');
    
    // Create temporary input element
    var tempInput = document.createElement('input');
    tempInput.value = shareUrl;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    
    try {
        tempInput.select();
        tempInput.setSelectionRange(0, 99999); // For mobile devices
        var success = document.execCommand('copy');
        
        if (success) {
            showSuccess('Share link copied to clipboard!');
        } else {
            showError('Please copy this link manually: ' + shareUrl);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showError('Please copy this link manually: ' + shareUrl);
    } finally {
        document.body.removeChild(tempInput);
    }
}
function showSuccess(message) {
    console.log('✅ Success:', message);
    
    var errorElement = document.getElementById('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.className = 'success-message'; // Use CSS class from HTML
        
        // Hide after 3 seconds
        setTimeout(function() {
            errorElement.style.display = 'none';
            errorElement.className = ''; // Reset class
        }, 3000);
    } else {
        // Fallback: create a temporary success message
        var successDiv = document.createElement('div');
        successDiv.textContent = message;
        successDiv.style.cssText = 'background: #4CAF50; color: white; padding: 10px; margin: 10px 0; border-radius: 4px;';
        document.body.insertBefore(successDiv, document.body.firstChild);
        
        setTimeout(function() {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Helper functions
function getSessionState(session) {
    console.log('📊 Getting session state:', session);
    
    if (!session) {
        return {
            players: {},
            votesRevealed: false,
            hasConsensus: false
        };
    }
    
    return {
        players: session.players || {},
        votesRevealed: session.votesRevealed || false,
        hasConsensus: checkConsensus(session)
    };
}

function checkConsensus(session) {
    if (!session || !session.players || !session.votesRevealed) {
        return false;
    }
    
    var votes = [];
    var players = session.players;
    
    // Collect all votes from non-spectator players
    for (var playerName in players) {
        if (players.hasOwnProperty(playerName)) {
            var player = players[playerName];
            if (!player.isSpectator && player.hasVoted && player.vote !== null) {
                votes.push(player.vote);
            }
        }
    }
    
    // Need at least 2 votes for consensus
    if (votes.length < 2) {
        return false;
    }
    
    // Check if all votes are the same
    var firstVote = votes[0];
    for (var i = 1; i < votes.length; i++) {
        if (votes[i] !== firstVote) {
            return false;
        }
    }
    
    console.log('🎯 Consensus reached! All votes are:', firstVote);
    return true;
}
// Debug function to check current state
function debugCurrentState() {
    console.log('🔍 Current App State Debug:');
    console.log('  - gameState:', gameState);
    console.log('  - isConnected:', gameState.isConnected);
    console.log('  - sessionCode:', gameState.sessionCode);
    console.log('  - playerName:', gameState.playerName);
    console.log('  - isSpectator:', gameState.isSpectator);
    console.log('  - currentVote:', gameState.currentVote);
    
    // Check authentication
    var authState = localStorage.getItem('planning-poker-authenticated');
    console.log('  - authState:', authState);
    
    // Check element visibility
    var passwordSection = document.getElementById('passwordSection');
    var gameSection = document.getElementById('gameSection');
    
    if (passwordSection) {
        console.log('  - passwordSection display:', window.getComputedStyle(passwordSection).display);
    }
    
    if (gameSection) {
        console.log('  - gameSection display:', window.getComputedStyle(gameSection).display);
    }
}
// Enhanced debugging function
function debugInterfaceState() {
    console.log('🔍 Interface Debug State:');
    
    var elements = [
        'passwordSection',
        'gameSection', 
        'joinForm',
        'sessionInterface',
        'votingCards',
        'playersSection',
        'controls'
    ];
    
    elements.forEach(function(id) {
        var element = document.getElementById(id);
        if (element) {
            var display = window.getComputedStyle(element).display;
            console.log('  ' + id + ': ' + display + ' (exists)');
        } else {
            console.log('  ' + id + ': MISSING ELEMENT');
        }
    });
}
// Helper function to force show password interface (for testing)
function forceShowPasswordInterface() {
    console.log('🚨 Force showing password interface for testing...');
    
    // Clear authentication
    localStorage.removeItem('planning-poker-authenticated');
    
    // Show password interface
    showPasswordInterface();
}
// Helper function to debug role configuration
function debugRoleInterface() {
    console.log('🔍 Role Interface Debug:');
    
    var elements = {
        'votingCards': document.getElementById('votingCards'),
        'resetButton': document.getElementById('resetButton'),
        'resetButtonSpectator': document.getElementById('resetButtonSpectator')
    };
    
    Object.keys(elements).forEach(function(key) {
        var element = elements[key];
        if (element) {
            var display = window.getComputedStyle(element).display;
            console.log('  ' + key + ': ' + display);
        } else {
            console.log('  ' + key + ': MISSING');
        }
    });
}
// Call this after authentication to check what's happening
function checkInterfaceAfterAuth() {
    console.log('🔧 Checking interface after authentication...');
    
    setTimeout(function() {
        debugInterfaceState();
        
        // Force show game interface if it's hidden
        var gameSection = document.getElementById('gameSection');
        if (gameSection && window.getComputedStyle(gameSection).display === 'none') {
            console.log('🚨 Game section is hidden! Forcing it to show...');
            gameSection.style.display = 'block';
        }
        
        var joinForm = document.getElementById('joinForm');
        if (joinForm && window.getComputedStyle(joinForm).display === 'none') {
            console.log('🚨 Join form is hidden! Forcing it to show...');
            joinForm.style.display = 'block';
        }
    }, 100);
}
function testRoleInterface() {
    console.log('🧪 Testing role-based interface...');
    
    // Test Spectator
    console.log('Testing Spectator role...');
    configureRoleBasedInterface(true);
    setTimeout(function() {
        debugRoleInterface();
        
        // Test Voter
        console.log('Testing Voter role...');
        configureRoleBasedInterface(false);
        setTimeout(function() {
            debugRoleInterface();
        }, 1000);
    }, 1000);
}
// TESTING FUNCTIONS - Add these to test authentication scenarios:

// Test fresh user experience (no stored auth)
function testFreshUser() {
    console.log('🧪 Testing fresh user experience...');
    localStorage.removeItem('planning-poker-authenticated');
    checkAuthentication();
}

// Test returning user experience (stored auth)
function testReturningUser() {
    console.log('🧪 Testing returning user experience...');
    localStorage.setItem('planning-poker-authenticated', 'true');
    checkAuthentication();
}

// Test shared link experience
function testSharedLink(sessionCode) {
    console.log('🧪 Testing shared link experience...');
    // Simulate clicking a shared link
    var url = new URL(window.location);
    url.searchParams.set('session', sessionCode || 'TEST123');
    window.history.pushState({}, '', url);
    
    // Clear auth to simulate new user
    localStorage.removeItem('planning-poker-authenticated');
    location.reload();
}