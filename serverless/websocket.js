// serverless/websocket.js - WebSocket handlers (pay-per-connection)

exports.connect = async (event) => {
  console.log('WebSocket connected:', event.requestContext.connectionId);
  return { statusCode: 200, body: 'Connected to cost-optimized serverless backend' };
};

exports.disconnect = async (event) => {
  console.log('WebSocket disconnected:', event.requestContext.connectionId);
  return { statusCode: 200, body: 'Disconnected' };
};
