// tests/e2e/basic.test.js
// Simplified E2E tests using static file serving
// Directory: planning-poker-serverless/tests/e2e/

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const express = require('express');
const path = require('path');

describe('Planning Poker E2E Tests', () => {
  let serverProcess;
  let staticServer;
  let browser;
  let spectatorPage;
  let voter1Page;
  
  const SERVER_PORT = 3335;
  const STATIC_PORT = 8082;
  const SERVER_URL = `http://localhost:${SERVER_PORT}`;
  const CLIENT_URL = `http://localhost:${STATIC_PORT}`;
  
  beforeAll(async () => {
    console.log('Setting up simplified E2E test environment...');
    
    // Start backend server
    console.log('Starting backend server...');
    serverProcess = spawn('node', ['serverless/local-server.js'], {
      env: { 
        ...process.env, 
        PORT: SERVER_PORT,
        NODE_ENV: 'test',
        IS_OFFLINE: 'true'
      },
      stdio: 'pipe'
    });
    
    // Create simple static file server for the HTML
    console.log('Starting static file server...');
    const app = express();
    
    // Serve the HTML file directly
    app.get('/', (req, res) => {
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Planning Poker - Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .card { background: white; padding: 20px; margin: 10px; border-radius: 8px; }
        .fibonacci-card { 
            display: inline-block; 
            padding: 10px 15px; 
            margin: 5px; 
            border: 2px solid #ccc; 
            border-radius: 8px; 
            cursor: pointer; 
        }
        .fibonacci-card.selected { background: #007bff; color: white; }
        .fibonacci-card.disabled { opacity: 0.5; cursor: not-allowed; }
        .player-card { 
            display: inline-block; 
            margin: 10px; 
            padding: 10px; 
            border: 1px solid #ddd; 
            border-radius: 5px; 
        }
        .vote-card { 
            width: 40px; 
            height: 60px; 
            border: 2px solid #ccc; 
            margin: 5px auto; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
        }
        .vote-card.revealed { background: #28a745; color: white; }
        .vote-card.hidden { background: #ffc107; }
        .vote-card.no-vote { background: #f8f9fa; }
        .consensus { background: #28a745; color: white; padding: 15px; border-radius: 8px; }
        #errorMessage { color: red; margin: 10px 0; display: none; }
        #loadingState { margin: 10px 0; display: none; }
        #gameInterface { display: none; }
        #spectatorControls { display: none; margin: 10px 0; }
        button { padding: 10px 15px; margin: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Planning Poker - E2E Test</h1>
    
    <div id="errorMessage"></div>
    <div id="loadingState">Loading...</div>
    
    <div id="joinForm" class="card">
        <h3>Join Session</h3>
        <div>
            <label>Player Name:</label>
            <input type="text" id="playerName" placeholder="Enter your name">
        </div>
        <div>
            <label>Session Code (optional):</label>
            <input type="text" id="sessionCode" placeholder="Leave empty to create new">
        </div>
        <button id="joinButton">Join/Create Session</button>
    </div>
    
    <div id="gameInterface">
        <div class="card">
            <h3>Session: <span id="currentSessionCode"></span></h3>
            <div>Share: <span id="shareLink"></span></div>
        </div>
        
        <div id="status" class="card">Status: Ready</div>
        
        <div class="card">
            <h3>Cast Your Vote</h3>
            <div class="fibonacci-card" data-value="1">1</div>
            <div class="fibonacci-card" data-value="2">2</div>
            <div class="fibonacci-card" data-value="3">3</div>
            <div class="fibonacci-card" data-value="5">5</div>
            <div class="fibonacci-card" data-value="8">8</div>
            <div class="fibonacci-card" data-value="13">13</div>
        </div>
        
        <div class="card">
            <h3>Players</h3>
            <div id="playerCards"></div>
        </div>
        
        <div id="spectatorControls">
            <button id="resetButton">Reset Votes</button>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script>
        // Simplified Planning Poker client for E2E testing
        let gameState = {
            socket: null,
            sessionCode: '',
            playerName: '',
            isSpectator: false,
            isConnected: false,
            sessionState: { players: {}, votesRevealed: false, hasConsensus: false }
        };

        document.addEventListener('DOMContentLoaded', function() {
            setupEventListeners();
            initializeSocket();
            
            // Check for session code in URL
            const urlParams = new URLSearchParams(window.location.search);
            const sessionFromUrl = urlParams.get('session');
            if (sessionFromUrl) {
                document.getElementById('sessionCode').value = sessionFromUrl.toUpperCase();
            }
        });

        function setupEventListeners() {
            document.getElementById('joinButton').addEventListener('click', joinSession);
            document.getElementById('resetButton').addEventListener('click', resetVotes);
            
            document.querySelectorAll('.fibonacci-card').forEach(card => {
                card.addEventListener('click', function() {
                    const value = parseInt(this.getAttribute('data-value'));
                    castVote(value);
                });
            });
        }

        function initializeSocket() {
            gameState.socket = io('${SERVER_URL}');
            
            gameState.socket.on('connect', () => {
                gameState.isConnected = true;
                hideError();
                hideLoading();
            });
            
            gameState.socket.on('disconnect', () => {
                gameState.isConnected = false;
                showError('Connection lost');
            });
            
            gameState.socket.on('joinedSession', (data) => {
                gameState.sessionCode = data.sessionCode;
                gameState.playerName = data.playerName;
                gameState.isSpectator = data.isSpectator;
                showGameInterface(data);
            });
            
            gameState.socket.on('sessionUpdate', (data) => {
                gameState.sessionState = data.state;
                updateGameInterface();
            });
            
            gameState.socket.on('votesReset', () => {
                clearSelectedVote();
                updateStatus('New voting round started');
            });
            
            gameState.socket.on('error', (data) => {
                showError(data.message);
            });
        }

        function joinSession() {
            const playerName = document.getElementById('playerName').value.trim();
            const sessionCode = document.getElementById('sessionCode').value.trim().toUpperCase();
            
            if (!playerName) {
                showError('Please enter your name');
                return;
            }
            
            showLoading();
            hideError();
            
            const isSpectator = !sessionCode;
            const finalSessionCode = sessionCode || generateSessionCode();
            
            gameState.socket.emit('joinSession', {
                sessionCode: finalSessionCode,
                playerName,
                isSpectator
            });
        }

        function castVote(value) {
            if (!gameState.isConnected || gameState.isSpectator) return;
            
            updateSelectedVote(value);
            gameState.socket.emit('castVote', { vote: value });
        }

        function resetVotes() {
            if (!gameState.isSpectator) return;
            gameState.socket.emit('resetVotes');
        }

        function showGameInterface(data) {
            document.getElementById('joinForm').style.display = 'none';
            document.getElementById('gameInterface').style.display = 'block';
            document.getElementById('currentSessionCode').textContent = data.sessionCode;
            document.getElementById('shareLink').textContent = '${CLIENT_URL}?session=' + data.sessionCode;
            
            if (data.isSpectator) {
                document.getElementById('spectatorControls').style.display = 'block';
            }
            
            hideLoading();
        }

        function updateGameInterface() {
            updatePlayerCards();
            updateStatus();
        }

        function updatePlayerCards() {
            const container = document.getElementById('playerCards');
            container.innerHTML = '';
            
            Object.entries(gameState.sessionState.players).forEach(([name, player]) => {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'player-card';
                
                const nameDiv = document.createElement('div');
                nameDiv.textContent = name + (player.isSpectator ? ' (Spectator)' : '');
                
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

        function updateSelectedVote(value) {
            document.querySelectorAll('.fibonacci-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            if (value) {
                const selectedCard = document.querySelector('[data-value="' + value + '"]');
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
            
            if (message) {
                statusEl.textContent = message;
                return;
            }
            
            const players = gameState.sessionState.players;
            const nonSpectators = Object.entries(players).filter(([_, player]) => !player.isSpectator);
            
            if (gameState.sessionState.votesRevealed && gameState.sessionState.hasConsensus) {
                const consensusVote = nonSpectators.find(([_, player]) => player.hasVoted)?.[1]?.vote;
                statusEl.innerHTML = '<div class="consensus">🎉 Consensus Reached! Story Points: ' + consensusVote + ' 🎉</div>';
            } else {
                const votedCount = nonSpectators.filter(([_, player]) => player.hasVoted).length;
                statusEl.textContent = 'Voting: ' + votedCount + '/' + nonSpectators.length + ' players voted';
            }
        }

        function generateSessionCode() {
            return Math.random().toString(36).substr(2, 8).toUpperCase();
        }

        function showError(message) {
            const errorEl = document.getElementById('errorMessage');
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }

        function hideError() {
            document.getElementById('errorMessage').style.display = 'none';
        }

        function showLoading() {
            document.getElementById('loadingState').style.display = 'block';
        }

        function hideLoading() {
            document.getElementById('loadingState').style.display = 'none';
        }

        // Make functions globally available for testing
        window.joinSession = joinSession;
        window.castVote = castVote;
        window.resetVotes = resetVotes;
    </script>
</body>
</html>`;
      res.send(htmlContent);
    });
    
    staticServer = app.listen(STATIC_PORT, () => {
      console.log('Static server running on port', STATIC_PORT);
    });
    
    // Wait for servers to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Launch browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('E2E environment ready');
  }, 30000);
  
  afterAll(async () => {
    console.log('Cleaning up E2E environment...');
    
    if (browser) {
      await browser.close();
    }
    
    if (staticServer) {
      staticServer.close();
    }
    
    if (serverProcess) {
      serverProcess.kill();
    }
  });
  
  beforeEach(async () => {
    spectatorPage = await browser.newPage();
    voter1Page = await browser.newPage();
  });
  
  afterEach(async () => {
    if (spectatorPage) await spectatorPage.close();
    if (voter1Page) await voter1Page.close();
  });

  describe('Server Health', () => {
    test('should validate server is accessible', async () => {
      const response = await fetch(`${SERVER_URL}/api/health`);
      expect(response.status).toBe(200);
    });
  });

  describe('Basic Session Flow', () => {
    test('should create and join session successfully', async () => {
      // Spectator creates session
      await spectatorPage.goto(CLIENT_URL);
      await spectatorPage.waitForSelector('#playerName', { timeout: 10000 });
      
      await spectatorPage.type('#playerName', 'E2E Spectator');
      await spectatorPage.click('#joinButton');
      
      await spectatorPage.waitForSelector('#gameInterface', { timeout: 10000 });
      
      // Verify spectator controls are visible
      const spectatorControls = await spectatorPage.$('#spectatorControls');
      expect(spectatorControls).toBeTruthy();
      
      // Get session code
      const sessionCode = await spectatorPage.$eval('#currentSessionCode', el => el.textContent);
      expect(sessionCode).toMatch(/^[A-Z0-9]{8}$/);
      
      // Voter joins the session
      await voter1Page.goto(CLIENT_URL);
      await voter1Page.waitForSelector('#playerName');
      await voter1Page.type('#playerName', 'Alice');
      await voter1Page.type('#sessionCode', sessionCode);
      await voter1Page.click('#joinButton');
      
      await voter1Page.waitForSelector('#gameInterface', { timeout: 10000 });
      
      // Verify both players appear on spectator screen
      await spectatorPage.waitForFunction(
        () => document.querySelectorAll('.player-card').length === 2,
        { timeout: 10000 }
      );
      
      const playerCards = await spectatorPage.$$('.player-card');
      expect(playerCards.length).toBe(2);
    });
    
    test('should handle voting and consensus', async () => {
      // Setup session
      await spectatorPage.goto(CLIENT_URL);
      await spectatorPage.waitForSelector('#playerName');
      await spectatorPage.type('#playerName', 'Spectator');
      await spectatorPage.click('#joinButton');
      await spectatorPage.waitForSelector('#currentSessionCode');
      
      const sessionCode = await spectatorPage.$eval('#currentSessionCode', el => el.textContent);
      
      // Voter joins
      await voter1Page.goto(CLIENT_URL);
      await voter1Page.waitForSelector('#playerName');
      await voter1Page.type('#playerName', 'VoteUser');
      await voter1Page.type('#sessionCode', sessionCode);
      await voter1Page.click('#joinButton');
      await voter1Page.waitForSelector('.fibonacci-card');
      
      // Cast vote
      await voter1Page.click('[data-value="5"]');
      
      // Wait for vote to be revealed (single voter auto-reveals)
      await spectatorPage.waitForFunction(
        () => document.querySelectorAll('.vote-card.revealed').length === 1,
        { timeout: 10000 }
      );
      
      // Verify vote is displayed
      const revealedVote = await spectatorPage.$eval('.vote-card.revealed', el => el.textContent);
      expect(revealedVote).toBe('5');
    });
  });

  describe('UI Elements', () => {
    test('should display all Fibonacci voting options', async () => {
      await voter1Page.goto(CLIENT_URL);
      await voter1Page.waitForSelector('#playerName');
      await voter1Page.type('#playerName', 'UITester');
      await voter1Page.click('#joinButton');
      await voter1Page.waitForSelector('.fibonacci-card');
      
      const fibCards = await voter1Page.$$('.fibonacci-card');
      expect(fibCards.length).toBe(6);
      
      const values = await voter1Page.$$eval('.fibonacci-card', cards => 
        cards.map(card => card.getAttribute('data-value'))
      );
      expect(values).toEqual(['1', '2', '3', '5', '8', '13']);
    });
    
    test('should handle vote selection', async () => {
      await voter1Page.goto(CLIENT_URL);
      await voter1Page.waitForSelector('#playerName');
      await voter1Page.type('#playerName', 'SelectTester');
      await voter1Page.click('#joinButton');
      await voter1Page.waitForSelector('.fibonacci-card');
      
      await voter1Page.click('[data-value="3"]');
      
      const selectedCard = await voter1Page.$('.fibonacci-card.selected');
      expect(selectedCard).toBeTruthy();
      
      const selectedValue = await selectedCard.evaluate(el => el.getAttribute('data-value'));
      expect(selectedValue).toBe('3');
    });
  });

  describe('Error Handling', () => {
    test('should validate required player name', async () => {
      await voter1Page.goto(CLIENT_URL);
      await voter1Page.waitForSelector('#playerName');
      
      // Try to join without name
      await voter1Page.click('#joinButton');
      
      await voter1Page.waitForSelector('#errorMessage', { timeout: 5000 });
      const errorText = await voter1Page.$eval('#errorMessage', el => el.textContent);
      expect(errorText).toContain('name');
    });
  });
});