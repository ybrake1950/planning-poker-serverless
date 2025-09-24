var isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
console.log('Environment detected:', isLocal ? 'Development' : 'Production');

var gameState = {
    websocket: null,
    isConnected: false
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('Planning Poker starting...');
    document.getElementById('passwordSection').style.display = 'none';
    document.getElementById('gameSection').style.display = 'block';
    connectToWebSocket();
    
    document.getElementById('joinButton').addEventListener('click', function() {
        console.log('Join button clicked');
        
        var playerName = document.getElementById('playerName').value.trim();
        var sessionCode = document.getElementById('sessionCode').value.trim().toUpperCase();
        var isSpectator = document.getElementById('isSpectator').checked;
        
        if (!playerName) {
            console.error('Player name is required');
            return;
        }
        
        if (!sessionCode) {
            sessionCode = generateSessionCode();
        }
        
        if (gameState.isConnected) {
            console.log('Sending join session message...');
            var message = {
                action: 'joinSession',
                sessionCode: sessionCode,
                playerName: playerName,
                isSpectator: isSpectator
            };
            
            gameState.websocket.send(JSON.stringify(message));
            console.log('Sent:', message);
        } else {
            console.log('WebSocket not connected yet');
        }
    });
});

function connectToWebSocket() {
    var wsUrl = isLocal ? 'ws://localhost:3001' : 'wss://wmfyys4er5.execute-api.us-east-1.amazonaws.com/prod';
    console.log('Using WebSocket endpoint:', wsUrl);
    
    gameState.websocket = new WebSocket(wsUrl);
    
    gameState.websocket.onopen = function() {
        console.log('WebSocket connected successfully');
        gameState.isConnected = true;
        updateConnectionStatus('connected');
    };
    
    gameState.websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus('disconnected');
    };
}

function updateConnectionStatus(status) {
    var statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
        statusElement.className = status === 'connected' ? 'status-connected' : 'status-disconnected';
    }
}

function generateSessionCode() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var result = "";
    for (var i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function handleWebSocketMessage(data) {
    console.log('Raw response from backend:', data);
    
    try {
        var message = JSON.parse(data);
        console.log('Parsed backend message:', message);
        
        if (message.type === 'sessionJoined' || 
            message.action === 'sessionJoined' || 
            message.status === 'success' ||
            message.message === 'joined' ||
            (message.sessionCode && message.playerName)) {
            
            console.log('Session join detected - transitioning to game interface');
            
            var joinForm = document.getElementById('joinForm');
            var sessionInterface = document.getElementById('sessionInterface');
            
            if (joinForm && sessionInterface) {
                joinForm.style.display = 'none';
                sessionInterface.style.display = 'block';
                console.log('Interface transition completed');
                
                var sessionCode = message.sessionCode || document.getElementById('sessionCode').value || 'UNKNOWN';
                var playerName = message.playerName || document.getElementById('playerName').value || 'Player';
                
                document.getElementById('currentSessionCode').textContent = sessionCode;
                document.getElementById('currentPlayerName').textContent = playerName;
            }
        } else {
            console.log('Response did not match expected format - forcing transition');
            document.getElementById('joinForm').style.display = 'none';
            document.getElementById('sessionInterface').style.display = 'block';
        }
    } catch (error) {
        console.error('Error parsing response:', error);
        document.getElementById('joinForm').style.display = 'none';
        document.getElementById('sessionInterface').style.display = 'block';
    }
}
