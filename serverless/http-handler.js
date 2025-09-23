// serverless/http-handler.js
// HTTP API endpoints for Planning Poker
// Directory: planning-poker/serverless/http-handler.js

const AWS = require('aws-sdk');

// Initialize DynamoDB client
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Create session endpoint
exports.createSession = async (event) => {
  console.log('Creating new session');
  
  try {
    // Generate unique session code
    const sessionCode = generateSessionCode();
    
    // Create session object
    const session = {
      sessionCode: sessionCode,
      players: {},
      votesRevealed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 hours TTL
    };
    
    // Store in DynamoDB
    const params = {
      TableName: process.env.SESSIONS_TABLE,
      Item: session
    };
    
    await dynamoDb.put(params).promise();
    
    // Determine frontend URL based on environment
    const frontendUrl = process.env.FRONTEND_URL || 
                       (event.headers.origin || 'https://team2playscards.com');
    
    // Return session details
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionCode: sessionCode,
        shareUrl: `${frontendUrl}?session=${sessionCode}`,
        message: 'Session created successfully'
      })
    };
    
  } catch (error) {
    console.error('Error creating session:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
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
  const sessionCode = event.pathParameters.sessionCode.toUpperCase();
  console.log('Getting session:', sessionCode);
  
  try {
    // Get session from DynamoDB
    const params = {
      TableName: process.env.SESSIONS_TABLE,
      Key: { sessionCode: sessionCode }
    };
    
    const result = await dynamoDb.get(params).promise();
    const session = result.Item;
    
    if (!session) {
      return {
        statusCode: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Session not found',
          sessionCode: sessionCode
        })
      };
    }
    
    // Calculate consensus
    const hasConsensus = checkConsensus(session.players);
    
    // Return session state
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionCode: sessionCode,
        state: {
          players: session.players || {},
          votesRevealed: session.votesRevealed || false,
          hasConsensus: hasConsensus
        },
        metadata: {
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          playerCount: Object.keys(session.players || {}).length
        }
      })
    };
    
  } catch (error) {
    console.error('Error getting session:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
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
  console.log('Health check requested');
  
  try {
    // Test DynamoDB connectivity
    const testParams = {
      TableName: process.env.SESSIONS_TABLE,
      Limit: 1
    };
    
    await dynamoDb.scan(testParams).promise();
    
    // Return health status
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'healthy',
        service: 'Planning Poker WebSocket API',
        version: '2.0-serverless',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        region: process.env.AWS_REGION,
        checks: {
          database: 'connected',
          memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          uptime: `${Math.round(process.uptime())}s`
        }
      })
    };
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return {
      statusCode: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'unhealthy',
        error: 'Database connectivity issue',
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Handle OPTIONS requests for CORS
exports.options = async (event) => {
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  };
};

// Helper function to generate session codes
function generateSessionCode() {
  // Generate 8-character alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Helper function to check if consensus is reached
function checkConsensus(players) {
  if (!players) return false;
  
  // Get all votes from non-spectator players
  const votes = Object.values(players)
    .filter(player => !player.isSpectator && player.vote !== null && player.vote !== undefined)
    .map(player => player.vote);
  
  // Need at least 2 votes for consensus
  if (votes.length < 2) return false;
  
  // Check if all votes are the same
  return votes.every(vote => vote === votes[0]);
}