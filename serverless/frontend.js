const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  console.log('Frontend request:', event.rawPath || event.path);
  
  try {
    // Always serve index.html for SPA routing
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300'
      },
      body: indexContent
    };
  } catch (error) {
    console.error('Error serving frontend:', error);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: '<html><body><h1>Planning Poker</h1><p>Frontend loading...</p></body></html>'
    };
  }
};
