// tests/integration/debug.test.js  
// Debug version to understand what's happening with voting
// Directory: planning-poker-serverless/tests/integration/

const { spawn } = require('child_process');
const Client = require('socket.io-client');

describe('Debug Integration Tests', () => {
  let serverProcess;
  let client;
  
  // Start server before tests
  beforeAll((done) => {
    console.log('🚀 Starting debug server...');
    
    serverProcess = spawn('node', ['serverless/local-server.js'], {
      env: { 
        ...process.env, 
        PORT: 3334, // Different port to avoid conflicts
        NODE_ENV: 'test',
        IS_OFFLINE: 'true',
        DEBUG: 'true' // Enable debug output
      },
      stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr
    });
    
    // Log server output for debugging
    serverProcess.stdout.on('data', (data) => {
      console.log('SERVER:', data.toString().trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('SERVER ERROR:', data.toString().trim());
    });
    
    // Wait for server to start
    setTimeout(() => {
      console.log('✅ Debug server should be ready');
      done();
    }, 4000);
  });
  
  // Stop server after tests
  afterAll(() => {
    if (client) {
      client.close();
    }
    
    if (serverProcess) {
      serverProcess.kill();
      console.log('🛑 Debug server stopped');
    }
  });
  
  // Clean up client after each test
  afterEach(() => {
    if (client) {
      client.close();
      client = null;
    }
  });

  test('should debug voting workflow step by step', (done) => {
    client = new Client('http://localhost:3334', {
      transports: ['websocket']
    });
    
    let sessionJoined = false;
    let voteSubmitted = false;
    
    console.log('🔌 Attempting to connect...');
    
    client.on('connect', () => {
      console.log('✅ Connected to debug server, socket ID:', client.id);
      
      console.log('📝 Sending joinSession event...');
      client.emit('joinSession', {
        sessionCode: 'DEBUG01',
        playerName: 'DebugPlayer',
        isSpectator: false
      });
    });
    
    client.on('joinedSession', (data) => {
      console.log('✅ Joined session successfully:', data);
      sessionJoined = true;
      
      // Wait a moment, then cast vote
      setTimeout(() => {
        console.log('🗳️ Casting vote...');
        client.emit('castVote', { vote: 5 });
        voteSubmitted = true;
      }, 500);
    });
    
    client.on('sessionUpdate', (data) => {
      console.log('📊 Session update received:', JSON.stringify(data.state, null, 2));
      
      if (sessionJoined && voteSubmitted) {
        const player = data.state.players.DebugPlayer;
        
        if (player) {
          console.log('👤 Player state:', JSON.stringify(player, null, 2));
          console.log('📝 hasVoted:', player.hasVoted);
          console.log('🗳️ vote:', player.vote);
          console.log('🎭 isSpectator:', player.isSpectator);
          
          // Check if vote was recorded
          if (player.hasVoted === true) {
            console.log('✅ Vote was recorded successfully!');
            done();
          } else {
            console.log('❌ Vote was NOT recorded - this is the bug');
            // Let's wait a bit more in case it's a timing issue
            setTimeout(() => {
              console.log('⏰ Checking again after delay...');
              // The test will fail if still not voted
              done(new Error('Vote was not recorded after delay'));
            }, 1000);
          }
        } else {
          console.log('❌ Player not found in session state');
          done(new Error('Player not found in session'));
        }
      }
    });
    
    client.on('error', (error) => {
      console.error('❌ Socket error:', error);
      done(new Error('Socket error: ' + error.message));
    });
    
    client.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      done(new Error('Connection error: ' + error.message));
    });
  }, 15000);
});
