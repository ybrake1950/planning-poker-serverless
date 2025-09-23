// In-memory version for testing without DynamoDB

const sessions = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

exports.createSession = async (event) => {
  console.log('Creating new session');
  
  try {
    const sessionCode = generateSessionCode();
    
    const session = {
      sessionCode: sessionCode,
      players: {},
      votesRevealed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    sessions.set(sessionCode, session);
    
    const frontendUrl = 'http://localhost:8080';
    
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

exports.getSession = async (event) => {
  const sessionCode = event.pathParameters.sessionCode.toUpperCase();
  console.log('Getting session:', sessionCode);
  
  try {
    const session = sessions.get(sessionCode);
    
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
    
    const hasConsensus = checkConsensus(session.players);
    
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

exports.healthCheck = async (event) => {
  console.log('Health check requested');
  
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'healthy',
      service: 'Planning Poker WebSocket API (In-Memory)',
      version: '2.0-serverless-testing',
      timestamp: new Date().toISOString(),
      environment: 'development',
      checks: {
        database: 'in-memory',
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(process.uptime())}s`,
        sessions: sessions.size
      }
    })
  };
};

function generateSessionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

function checkConsensus(players) {
  if (!players) return false;
  
  const votes = Object.values(players)
    .filter(player => !player.isSpectator && player.vote !== null && player.vote !== undefined)
    .map(player => player.vote);
  
  if (votes.length < 2) return false;
  return votes.every(vote => vote === votes[0]);
}
