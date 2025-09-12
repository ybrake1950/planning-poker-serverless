// serverless/api.js - HTTP API endpoints (pay-per-request)
const { createSession, generateSessionCode } = require('./index');

exports.healthCheck = async () => ({
  statusCode: 200,
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'healthy',
    architecture: 'pure-serverless',
    costModel: 'pay-per-use (~$2-5/month vs $25 traditional)',
    savings: '80-90%'
  })
});

exports.createSession = async () => {
  try {
    const sessionCode = generateSessionCode();
    await createSession(sessionCode);
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionCode,
        shareUrl: `http://localhost:3000?session=${sessionCode}`,
        costOptimized: true 
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create session' })
    };
  }
};
