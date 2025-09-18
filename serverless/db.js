// serverless/db.js
// Fixed database helper functions with ES5 syntax (no const/let)
// Directory: serverless/db.js

// Check if running offline/locally first
var isOffline = process.env.IS_OFFLINE || process.env.NODE_ENV === 'development';

// Only configure AWS SDK if not running offline
var dynamodb = null;
if (!isOffline) {
  var AWS = require('aws-sdk');
  
  // Configure DynamoDB for production
  dynamodb = new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

// In-memory storage for local development (simulates DynamoDB)
var localSessions = new Map();
var localConnections = new Map();

var SESSIONS_TABLE = process.env.SESSIONS_TABLE || 'planning-poker-sessions-dev';
var CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'planning-poker-connections-dev';

console.log('🔧 Database initialized in', isOffline ? 'LOCAL' : 'PRODUCTION', 'mode');

// Session management functions
function createSession(sessionCode) {
  console.log('📝 Creating session:', sessionCode);
  
  var session = {
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
    return Promise.resolve(session);
  } else {
    // Store in DynamoDB for production
    var params = {
      TableName: SESSIONS_TABLE,
      Item: session
    };
    
    return dynamodb.put(params).promise().then(function() {
      console.log('☁️ Session stored in DynamoDB (production)');
      return session;
    });
  }
}

function getSession(sessionCode) {
  console.log('🔍 Getting session:', sessionCode);
  
  if (isOffline) {
    // Get from memory for local development
    var session = localSessions.get(sessionCode);
    console.log('💾 Retrieved from memory (local dev):', !!session);
    return Promise.resolve(session);
  } else {
    // Get from DynamoDB for production
    var params = {
      TableName: SESSIONS_TABLE,
      Key: { sessionCode: sessionCode }
    };
    
    return dynamodb.get(params).promise().then(function(result) {
      console.log('☁️ Retrieved from DynamoDB (production):', !!result.Item);
      return result.Item;
    });
  }
}

function updateSession(sessionCode, updates) {
  console.log('✏️ Updating session:', sessionCode, 'with', Object.keys(updates));
  
  if (isOffline) {
    // Update in memory for local development
    var session = localSessions.get(sessionCode);
    if (session) {
      // Create updated session object
      var updatedSession = {};
      for (var key in session) {
        if (session.hasOwnProperty(key)) {
          updatedSession[key] = session[key];
        }
      }
      for (var updateKey in updates) {
        if (updates.hasOwnProperty(updateKey)) {
          updatedSession[updateKey] = updates[updateKey];
        }
      }
      
      localSessions.set(sessionCode, updatedSession);
      console.log('💾 Session updated in memory (local dev)');
      return Promise.resolve(updatedSession);
    } else {
      console.log('❌ Session not found in memory:', sessionCode);
      return Promise.resolve(null);
    }
  } else {
    // Update in DynamoDB for production
    var updateExpressions = [];
    var expressionAttributeNames = {};
    var expressionAttributeValues = {};
    
    for (var key in updates) {
      if (updates.hasOwnProperty(key)) {
        updateExpressions.push('#' + key + ' = :' + key);
        expressionAttributeNames['#' + key] = key;
        expressionAttributeValues[':' + key] = updates[key];
      }
    }
    
    var params = {
      TableName: SESSIONS_TABLE,
      Key: { sessionCode: sessionCode },
      UpdateExpression: 'SET ' + updateExpressions.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    return dynamodb.update(params).promise().then(function(result) {
      console.log('☁️ Session updated in DynamoDB (production)');
      return result.Attributes;
    });
  }
}

// Connection management functions
function storeConnection(connectionId, sessionCode, playerName, isSpectator) {
  console.log('🔗 Storing connection:', connectionId, 'for', playerName, 'in session', sessionCode);
  
  var connection = {
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
    return Promise.resolve();
  } else {
    // Store in DynamoDB for production
    var params = {
      TableName: CONNECTIONS_TABLE,
      Item: connection
    };
    
    return dynamodb.put(params).promise().then(function() {
      console.log('☁️ Connection stored in DynamoDB (production)');
    });
  }
}

function getConnection(connectionId) {
  console.log('🔍 Getting connection:', connectionId);
  
  if (isOffline) {
    // Get from memory for local development
    var connection = localConnections.get(connectionId);
    console.log('💾 Retrieved connection from memory (local dev):', !!connection);
    return Promise.resolve(connection);
  } else {
    // Get from DynamoDB for production
    var params = {
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId: connectionId }
    };
    
    return dynamodb.get(params).promise().then(function(result) {
      console.log('☁️ Retrieved connection from DynamoDB (production):', !!result.Item);
      return result.Item;
    });
  }
}

function removeConnection(connectionId) {
  console.log('🗑️ Removing connection:', connectionId);
  
  if (isOffline) {
    // Remove from memory for local development
    var removed = localConnections.delete(connectionId);
    console.log('💾 Connection removed from memory (local dev):', removed);
    return Promise.resolve();
  } else {
    // Remove from DynamoDB for production
    var params = {
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId: connectionId }
    };
    
    return dynamodb.delete(params).promise().then(function() {
      console.log('☁️ Connection removed from DynamoDB (production)');
    });
  }
}

function getConnectionsBySession(sessionCode) {
  console.log('🔍 Getting connections for session:', sessionCode);
  
  if (isOffline) {
    // Get from memory for local development
    var connections = [];
    localConnections.forEach(function(connection) {
      if (connection.sessionCode === sessionCode) {
        connections.push(connection);
      }
    });
    console.log('💾 Found', connections.length, 'connections in memory (local dev)');
    return Promise.resolve(connections);
  } else {
    // Get from DynamoDB for production
    var params = {
      TableName: CONNECTIONS_TABLE,
      IndexName: 'SessionIndex',
      KeyConditionExpression: 'sessionCode = :sessionCode',
      ExpressionAttributeValues: {
        ':sessionCode': sessionCode
      }
    };
    
    return dynamodb.query(params).promise().then(function(result) {
      console.log('☁️ Found', result.Items.length, 'connections in DynamoDB (production)');
      return result.Items;
    });
  }
}

// Utility function to check consensus
function checkConsensus(session) {
  if (!session.votesRevealed) return false;
  
  var votes = [];
  for (var playerName in session.players) {
    if (session.players.hasOwnProperty(playerName)) {
      var player = session.players[playerName];
      if (!player.isSpectator && player.hasVoted) {
        votes.push(player.vote);
      }
    }
  }
  
  if (votes.length === 0) return false;
  
  // Check if all votes are the same
  var firstVote = votes[0];
  for (var i = 0; i < votes.length; i++) {
    if (votes[i] !== firstVote) {
      return false;
    }
  }
  return true;
}

// Debug function to show current state
function debugState() {
  console.log('📊 Debug State:');
  console.log('  Sessions in memory:', localSessions.size);
  console.log('  Connections in memory:', localConnections.size);
  
  localSessions.forEach(function(session, code) {
    var playerCount = Object.keys(session.players || {}).length;
    console.log('  Session ' + code + ': ' + playerCount + ' players');
  });
}

module.exports = {
  createSession: createSession,
  getSession: getSession,
  updateSession: updateSession,
  storeConnection: storeConnection,
  getConnection: getConnection,
  removeConnection: removeConnection,
  getConnectionsBySession: getConnectionsBySession,
  checkConsensus: checkConsensus,
  debugState: debugState
}