// serverless/db.js
// Fixed database helper functions with proper AWS configuration

// Check if running offline/locally first
const isOffline = process.env.IS_OFFLINE || process.env.NODE_ENV === 'development';

// Only configure AWS SDK if not running offline
let dynamodb = null;
if (!isOffline) {
  const AWS = require('aws-sdk');
  
  // Configure DynamoDB for production
  dynamodb = new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

// In-memory storage for local development (simulates DynamoDB)
const localSessions = new Map();
const localConnections = new Map();

const SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'planning-poker-sessions-dev';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'planning-poker-connections-dev';

console.log('🔧 Database initialized in', isOffline ? 'LOCAL' : 'PRODUCTION', 'mode');

// Session management functions
async function createSession(sessionCode) {
  console.log('📝 Creating session:', sessionCode);
  
  const session = {
    sessionCode: sessionCode,
    players: {},
    votesRevealed: false,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 7200 // 2 hours TTL
  };
  
  if (isOffline) {
    // Store in memory for local development
    localSessions.set(sessionCode, session);
    console.log('💾 Session stored in memory (local dev)');
  } else {
    // Store in DynamoDB for production
    const params = {
      TableName: SESSIONS_TABLE,
      Item: session
    };
    
    await dynamodb.put(params).promise();
    console.log('☁️ Session stored in DynamoDB (production)');
  }
  
  return session;
}

async function getSession(sessionCode) {
  console.log('🔍 Getting session:', sessionCode);
  
  if (isOffline) {
    // Get from memory for local development
    const session = localSessions.get(sessionCode);
    console.log('💾 Retrieved from memory (local dev):', !!session);
    return session;
  } else {
    // Get from DynamoDB for production
    const params = {
      TableName: SESSIONS_TABLE,
      Key: { sessionCode: sessionCode }
    };
    
    const result = await dynamodb.get(params).promise();
    console.log('☁️ Retrieved from DynamoDB (production):', !!result.Item);
    return result.Item;
  }
}

async function updateSession(sessionCode, updates) {
  console.log('✏️ Updating session:', sessionCode, 'with', Object.keys(updates));
  
  if (isOffline) {
    // Update in memory for local development
    const session = localSessions.get(sessionCode);
    if (session) {
      Object.assign(session, updates);
      localSessions.set(sessionCode, session);
      console.log('💾 Session updated in memory (local dev)');
      return session;
    } else {
      console.log('❌ Session not found in memory:', sessionCode);
      return null;
    }
  } else {
    // Update in DynamoDB for production
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach(key => {
      updateExpressions.push('#' + key + ' = :' + key);
      expressionAttributeNames['#' + key] = key;
      expressionAttributeValues[':' + key] = updates[key];
    });
    
    const params = {
      TableName: SESSIONS_TABLE,
      Key: { sessionCode: sessionCode },
      UpdateExpression: 'SET ' + updateExpressions.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(params).promise();
    console.log('☁️ Session updated in DynamoDB (production)');
    return result.Attributes;
  }
}

// Connection management functions
async function storeConnection(connectionId, sessionCode, playerName, isSpectator) {
  console.log('🔗 Storing connection:', connectionId, 'for', playerName, 'in session', sessionCode);
  
  const connection = {
    connectionId: connectionId,
    sessionCode: sessionCode,
    playerName: playerName,
    isSpectator: isSpectator,
    connectedAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 7200
  };
  
  if (isOffline) {
    // Store in memory for local development
    localConnections.set(connectionId, connection);
    console.log('💾 Connection stored in memory (local dev)');
  } else {
    // Store in DynamoDB for production
    const params = {
      TableName: CONNECTIONS_TABLE,
      Item: connection
    };
    
    await dynamodb.put(params).promise();
    console.log('☁️ Connection stored in DynamoDB (production)');
  }
}

async function getConnection(connectionId) {
  console.log('🔍 Getting connection:', connectionId);
  
  if (isOffline) {
    // Get from memory for local development
    const connection = localConnections.get(connectionId);
    console.log('💾 Retrieved connection from memory (local dev):', !!connection);
    return connection;
  } else {
    // Get from DynamoDB for production
    const params = {
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId: connectionId }
    };
    
    const result = await dynamodb.get(params).promise();
    console.log('☁️ Retrieved connection from DynamoDB (production):', !!result.Item);
    return result.Item;
  }
}

async function removeConnection(connectionId) {
  console.log('🗑️ Removing connection:', connectionId);
  
  if (isOffline) {
    // Remove from memory for local development
    const removed = localConnections.delete(connectionId);
    console.log('💾 Connection removed from memory (local dev):', removed);
  } else {
    // Remove from DynamoDB for production
    const params = {
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId: connectionId }
    };
    
    await dynamodb.delete(params).promise();
    console.log('☁️ Connection removed from DynamoDB (production)');
  }
}

async function getConnectionsBySession(sessionCode) {
  console.log('🔍 Getting connections for session:', sessionCode);
  
  if (isOffline) {
    // Get from memory for local development
    const connections = [];
    localConnections.forEach(connection => {
      if (connection.sessionCode === sessionCode) {
        connections.push(connection);
      }
    });
    console.log('💾 Found', connections.length, 'connections in memory (local dev)');
    return connections;
  } else {
    // Get from DynamoDB for production
    const params = {
      TableName: CONNECTIONS_TABLE,
      IndexName: 'SessionIndex',
      KeyConditionExpression: 'sessionCode = :sessionCode',
      ExpressionAttributeValues: {
        ':sessionCode': sessionCode
      }
    };
    
    const result = await dynamodb.query(params).promise();
    console.log('☁️ Found', result.Items.length, 'connections in DynamoDB (production)');
    return result.Items;
  }
}

// Utility function to check consensus
function checkConsensus(session) {
  if (!session.votesRevealed) return false;
  
  const votes = [];
  for (const playerName in session.players) {
    const player = session.players[playerName];
    if (!player.isSpectator && player.hasVoted) {
      votes.push(player.vote);
    }
  }
  
  if (votes.length === 0) return false;
  
  // Check if all votes are the same
  const firstVote = votes[0];
  return votes.every(vote => vote === firstVote);
}

// Debug function to show current state
function debugState() {
  console.log('📊 Debug State:');
  console.log('  Sessions in memory:', localSessions.size);
  console.log('  Connections in memory:', localConnections.size);
  
  localSessions.forEach((session, code) => {
    const playerCount = Object.keys(session.players || {}).length;
    console.log(`  Session ${code}: ${playerCount} players`);
  });
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  storeConnection,
  getConnection,
  removeConnection,
  getConnectionsBySession,
  checkConsensus,
  debugState
};
