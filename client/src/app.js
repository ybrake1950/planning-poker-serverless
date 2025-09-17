// client/src/app.js - Planning Poker Frontend with Password Protection

class PlanningPokerApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.selectedVote = null;
        this.isSpectator = false;
        
        this.initializeElements();
        this.attachEventListeners();
    }
    
    initializeElements() {
        this.elements = {
            passwordForm: document.getElementById('passwordForm'),
            gameInterface: document.getElementById('gameInterface'),
            errorMessage: document.getElementById('errorMessage'),
            passwordFormElement: document.getElementById('passwordFormElement'),
            teamPassword: document.getElementById('teamPassword'),
            playerName: document.getElementById('playerName'),
            sessionCode: document.getElementById('sessionCode'),
            isSpectator: document.getElementById('isSpectator'),
            currentSessionCode: document.getElementById('currentSessionCode'),
            voteButtons: document.getElementById('voteButtons'),
            playersGrid: document.getElementById('playersGrid'),
            spectatorControls: document.getElementById('spectatorControls'),
            resetVotesBtn: document.getElementById('resetVotesBtn'),
            leaveSessionBtn: document.getElementById('leaveSessionBtn'),
            votingInterface: document.getElementById('votingInterface')
        };
    }
    
    attachEventListeners() {
        this.elements.passwordFormElement.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        
        this.elements.voteButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('vote-btn')) {
                this.castVote(e.target.dataset.vote);
            }
        });
        
        this.elements.resetVotesBtn.addEventListener('click', () => this.resetVotes());
        this.elements.leaveSessionBtn.addEventListener('click', () => this.leaveSession());
        
        // Handle URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const sessionFromUrl = urlParams.get('session');
        if (sessionFromUrl) {
            this.elements.sessionCode.value = sessionFromUrl.toUpperCase();
        }
    }
    
    // Environment detection for WebSocket URL
    getWebSocketUrl() {
        const isLocal = window.location.hostname === 'localhost';
        const isS3 = window.location.hostname.includes('s3-website');
        
        if (isLocal) {
            return 'ws://localhost:3001';
        } else {
            // Always use API Gateway WebSocket endpoint for production
            return 'wss://z68hjg7br2.execute-api.us-east-1.amazonaws.com/prod';
        }
    }
    
    async handleLogin() {
        const password = this.elements.teamPassword.value.trim();
        const playerName = this.elements.playerName.value.trim();
        const sessionCode = this.elements.sessionCode.value.trim();
        const isSpectator = this.elements.isSpectator.checked;
        
        if (!password || !playerName) {
            this.showError('Please enter both password and name');
            return;
        }
        
        this.currentUser = playerName;
        this.isSpectator = isSpectator;
        
        await this.connectToServer(password, playerName, sessionCode, isSpectator);
    }
    
    async connectToServer(password, playerName, sessionCode, isSpectator) {
        // Load Socket.IO if not available
        if (typeof io === 'undefined') {
            await this.loadSocketIO();
        }
        
        // Use environment-aware WebSocket URL
        const wsUrl = this.getWebSocketUrl();
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        
        this.socket = io(wsUrl, {
            transports: ['websocket'],
            timeout: 20000,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        this.setupSocketListeners(password, playerName, sessionCode, isSpectator);
    }
    
    loadSocketIO() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    setupSocketListeners(password, playerName, sessionCode, isSpectator) {
        this.socket.on('connect', () => {
            console.log('WebSocket connected successfully');
            this.socket.emit('joinSession', {
                sessionCode: sessionCode || '',
                playerName: playerName,
                password: password,
                isSpectator: isSpectator
            });
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.showError('Failed to connect to server. Please try again.');
        });
        
        this.socket.on('sessionUpdate', (sessionState) => {
            console.log('Session update received:', sessionState);
            this.showGameInterface();
            this.updateGameInterface(sessionState);
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showError(error.message || 'Connection failed');
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            this.showError('Disconnected from server');
        });
        
        // Additional debugging
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.error('WebSocket reconnection error:', error);
        });
    }
    
    castVote(vote) {
        if (!this.socket || this.isSpectator) return;
        
        this.selectedVote = vote;
        this.updateVoteButtons();
        
        this.socket.emit('castVote', {
            sessionCode: this.elements.currentSessionCode.textContent,
            vote: parseInt(vote)
        });
    }
    
    resetVotes() {
        if (!this.socket || !this.isSpectator) return;
        
        this.socket.emit('resetVotes', {
            sessionCode: this.elements.currentSessionCode.textContent
        });
    }
    
    leaveSession() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showPasswordForm();
        this.elements.passwordFormElement.reset();
        this.selectedVote = null;
        this.updateVoteButtons();
    }
    
    updateGameInterface(sessionState) {
        const sessionCode = sessionState.sessionCode || 'UNKNOWN';
        this.elements.currentSessionCode.textContent = sessionCode;
        
        this.updatePlayersDisplay(sessionState.players, sessionState.votesRevealed);
        this.updateSpectatorControls();
        
        // Update URL with session code for sharing
        if (sessionCode !== 'UNKNOWN') {
            const url = new URL(window.location);
            url.searchParams.set('session', sessionCode);
            window.history.replaceState({}, '', url);
        }
    }
    
    updatePlayersDisplay(players, votesRevealed) {
        this.elements.playersGrid.innerHTML = '';
        
        Object.entries(players).forEach(([playerName, playerData]) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            // Add current user indicator
            if (playerName === this.currentUser) {
                playerCard.classList.add('current-user');
            }
            
            const voteDisplay = playerData.isSpectator ? 
                '👁️ Spectator' : 
                (votesRevealed && playerData.vote !== null ? 
                    playerData.vote : 
                    (playerData.hasVoted ? '✓ Voted' : '⏳ Waiting'));
            
            playerCard.innerHTML = `
                <div class="player-name">${playerName}${playerName === this.currentUser ? ' (You)' : ''}</div>
                <div class="player-vote">${voteDisplay}</div>
            `;
            
            this.elements.playersGrid.appendChild(playerCard);
        });
    }
    
    updateVoteButtons() {
        const buttons = this.elements.voteButtons.querySelectorAll('.vote-btn');
        buttons.forEach(button => {
            button.classList.toggle('selected', button.dataset.vote === this.selectedVote);
        });
    }
    
    updateSpectatorControls() {
        this.elements.spectatorControls.style.display = this.isSpectator ? 'block' : 'none';
        this.elements.votingInterface.style.display = this.isSpectator ? 'none' : 'block';
    }
    
    showPasswordForm() {
        this.elements.passwordForm.classList.add('active');
        this.elements.gameInterface.classList.remove('active');
        
        // Clear any error messages
        this.elements.errorMessage.style.display = 'none';
    }
    
    showGameInterface() {
        this.elements.passwordForm.classList.remove('active');
        this.elements.gameInterface.classList.add('active');
        
        // Clear any error messages
        this.elements.errorMessage.style.display = 'none';
    }
    
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.display = 'block';
        
        // Auto-hide error after 5 seconds
        setTimeout(() => {
            if (this.elements.errorMessage.style.display !== 'none') {
                this.elements.errorMessage.style.display = 'none';
            }
        }, 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new PlanningPokerApp();
    
    // Add global error handler for debugging
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
    });
    
    // Debug info
    console.log('Planning Poker App initialized');
    console.log('Current hostname:', window.location.hostname);
    console.log('WebSocket URL will be:', new PlanningPokerApp().getWebSocketUrl());
});