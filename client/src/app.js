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
        if (gameState.isConnected) {
            console.log('WebSocket is connected and ready!');
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
