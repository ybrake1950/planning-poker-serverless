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
        const serverUrl = window.location.hostname === 'localhost' ? 
            'http://localhost:3001' : window.location.origin;
        
        // Load Socket.IO if not available
        if (typeof io === 'undefined') {
            await this.loadSocketIO();
        }
        
        this.socket = io(serverUrl);
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
            this.socket.emit('joinSession', {
                sessionCode: sessionCode || '',
                playerName: playerName,
                password: password,
                isSpectator: isSpectator
            });
        });
        
        this.socket.on('sessionUpdate', (sessionState) => {
            this.showGameInterface();
            this.updateGameInterface(sessionState);
        });
        
        this.socket.on('error', (error) => {
            this.showError(error.message || 'Connection failed');
        });
        
        this.socket.on('disconnect', () => {
            this.showError('Disconnected from server');
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
        if (this.socket) this.socket.disconnect();
        this.showPasswordForm();
        this.elements.passwordFormElement.reset();
    }
    
    updateGameInterface(sessionState) {
        const sessionCode = sessionState.sessionCode || 'UNKNOWN';
        this.elements.currentSessionCode.textContent = sessionCode;
        
        this.updatePlayersDisplay(sessionState.players, sessionState.votesRevealed);
        this.updateSpectatorControls();
    }
    
    updatePlayersDisplay(players, votesRevealed) {
        this.elements.playersGrid.innerHTML = '';
        
        Object.entries(players).forEach(([playerName, playerData]) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            const voteDisplay = playerData.isSpectator ? 
                '👁️ Spectator' : 
                (votesRevealed && playerData.vote !== null ? 
                    playerData.vote : 
                    (playerData.hasVoted ? '✓ Voted' : '⏳ Waiting'));
            
            playerCard.innerHTML = `
                <div>${playerName}</div>
                <div>${voteDisplay}</div>
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
    }
    
    showGameInterface() {
        this.elements.passwordForm.classList.remove('active');
        this.elements.gameInterface.classList.add('active');
    }
    
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.elements.errorMessage.style.display = 'none';
        }, 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PlanningPokerApp();
});
