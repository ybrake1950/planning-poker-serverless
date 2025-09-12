// serverless/api.js
// HTTP API handlers for Planning Poker

const { createSession, getSession } = require('./db');

// Generate a random session code
function generateSessionCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Create session endpoint
exports.createSession = async (event) => {
  console.log('📋 API: Creating new session');
  
  try {
    const sessionCode = generateSessionCode();
    await createSession(sessionCode);
    
    // Determine frontend URL based on environment
    const frontendUrl = process.env.FRONTEND_URL || 
                       (process.env.IS_OFFLINE ? 'http://localhost:8080' : 'https://yourdomainhere.com');
    
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionCode: sessionCode,
        shareUrl: frontendUrl + '?session=' + sessionCode
      })
    };
    
    console.log('✅ API: Session created successfully:', sessionCode);
    return response;
    
  } catch (error) {
    console.error('❌ API: Error creating session:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to create session',
        message: error.message
      })
    };
  }
};

// Get session endpoint
exports.getSession = async (event) => {
  console.log('📋 API: Getting session');
  
  try {
    const sessionCode = event.pathParameters.sessionCode.toUpperCase();
    console.log('🔍 API: Looking for session:', sessionCode);
    
    const session = await getSession(sessionCode);
    
    if (!session) {
      console.log('❌ API: Session not found:', sessionCode);
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Session not found',
          sessionCode: sessionCode
        })
      };
    }
    
    const response = {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionCode: sessionCode,
        state: {
          players: session.players || {},
          votesRevealed: session.votesRevealed || false,
          hasConsensus: false // Calculate if needed
        },
        shareUrl: (process.env.FRONTEND_URL || 'http://localhost:8080') + '?session=' + sessionCode
      })
    };
    
    console.log('✅ API: Session retrieved successfully:', sessionCode);
    return response;
    
  } catch (error) {
    console.error('❌ API: Error getting session:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to get session',
        message: error.message
      })
    };
  }
};

// Health check endpoint
exports.healthCheck = async (event) => {
  console.log('💚 API: Health check');
  
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0-serverless',
      environment: process.env.NODE_ENV || 'development'
    })
  };
};
