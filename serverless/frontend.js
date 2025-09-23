const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  console.log('Frontend request:', event.rawPath || event.path);
  
  try {
    // Look for index.html in the serverless directory
    const indexPath = path.join(__dirname, 'frontend-dist/index.html');
    
    if (!fs.existsSync(indexPath)) {
      console.error('index.html not found at:', indexPath);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html' },
        body: '<h1>Frontend build not found</h1><p>Built files not included in deployment</p>'
      };
    }
    
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
      statusCode: 500,
      headers: { 'Content-Type': 'text/html' },
      body: '<h1>Server Error</h1><p>Unable to load frontend: ' + error.message + '</p>'
    };
  }
};
