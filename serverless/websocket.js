// serverless/websocket.js
// WebSocket connection handlers for Planning Poker

const { storeConnection, removeConnection } = require('./db');

// WebSocket connection handler
exports.connect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('🔌 WebSocket: New connection:', connectionId);
  
  try {
    // For now, just log the connection
    // We'll store connection details when they join a session
    console.log('✅ WebSocket: Connection established:', connectionId);
    
    return {
      statusCode: 200,
      body: 'Connected successfully'
    };
    
  } catch (error) {
    console.error('❌ WebSocket: Connection error:', error);
    
    return {
      statusCode: 500,
      body: 'Failed to connect: ' + error.message
    };
  }
};

// WebSocket disconnection handler
exports.disconnect = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log('🔌 WebSocket: Disconnection:', connectionId);
  
  try {
    // Remove connection from database
    await removeConnection(connectionId);
    console.log('✅ WebSocket: Connection cleaned up:', connectionId);
    
    return {
      statusCode: 200,
      body: 'Disconnected successfully'
    };
    
  } catch (error) {
    console.error('❌ WebSocket: Disconnection error:', error);
    
    return {
      statusCode: 500,
      body: 'Failed to disconnect cleanly: ' + error.message
    };
  }
};
