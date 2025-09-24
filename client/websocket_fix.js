function connectToWebSocket() {
    var wsUrl;
    if (isLocal) {
        wsUrl = 'ws://localhost:3001';
        console.log('Using local WebSocket server:', wsUrl);
    } else {
        // Replace with your actual WebSocket API ID
        wsUrl = 'wss://wmfyys4er5.execute-api.us-east-1.amazonaws.com/prod';
        console.log('Using production WebSocket endpoint:', wsUrl);
    }
    
    try {
        console.log('🔌 Attempting to connect to WebSocket:', wsUrl);
        gameState.websocket = new WebSocket(wsUrl);
        setupWebSocketHandlers();
        updateConnectionStatus('connecting');
    } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        showError('Failed to connect to WebSocket server');
        updateConnectionStatus('disconnected');
    }
}
