// serverless/index.js - Core utilities for cost-optimized serverless functions
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  ...(process.env.IS_OFFLINE && { endpoint: 'http://localhost:8000' })
});

async function createSession(sessionCode) {
  const session = {
    sessionCode: sessionCode.toUpperCase(),
    players: {},
    votesRevealed: false,
    createdAt: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + 7200 // 2 hours TTL
  };
  
  await dynamodb.put({
    TableName: process.env.SESSIONS_TABLE,
    Item: session
  }).promise();
  
  return session;
}

function generateSessionCode() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

module.exports = { createSession, generateSessionCode, dynamodb };
