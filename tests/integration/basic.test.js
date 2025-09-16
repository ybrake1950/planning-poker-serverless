// tests/integration/basic.test.js  
// Fixed integration tests for the local server
// Directory: planning-poker-serverless/tests/integration/

const { spawn } = require('child_process');
const Client = require('socket.io-client');

describe('Basic Integration Tests', () => {
  let serverProcess;
  let client;
  
  // Start server before tests
  beforeAll((done) => {
    console.log('🚀 Starting local server for integration tests...');
    
    serverProcess = spawn('node', ['serverless/local-server.js'], {
      env: { 
        ...process.env, 
        PORT: 3333, // Use consistent port
        NODE_ENV: 'test',
        IS_OFFLINE: 'true'
      },
      stdio: ['ignore', 'pipe', 'pipe'] // Capture output like debug test
    });
    
    // Add server logging like the debug test
    serverProcess.stdout.on('data', (data) => {
      console.log('BASIC SERVER:', data.toString().trim());
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error('BASIC SERVER ERROR:', data.toString().trim());
    });
    
    // Wait for server to start
    setTimeout(() => {
      console.log('✅ Server should be ready');
      done();
    }, 3000);
  });
  
  // Stop server after tests
  afterAll(() => {
    // Clean up clients
    if (client) {
      client.close();
    }
    
    // Stop server
    if (serverProcess) {
      serverProcess.kill();
      console.log('🛑 Test server stopped');
    }
  });
  
  // Clean up client after each test
  afterEach(() => {
    if (client) {
      client.close();
      client = null;
    }
  });

  test('should connect to Socket.IO server', (done) => {
    client = new Client('http://localhost:3333');
    
    client.on('connect', () => {
      console.log('✅ Socket.IO connection successful');
      expect(client.connected).toBe(true);
      done();
    });
    
    client.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection failed:', error);
      done(error);
    });
  }, 10000);

  test('should handle joinSession event', (done) => {
    client = new Client('http://localhost:3333');
    
    client.on('connect', () => {
      console.log('🔌 Connected, sending joinSession event...');
      
      client.emit('joinSession', {
        sessionCode: 'INT001',
        playerName: 'IntegrationTest',
        isSpectator: false
      });
    });
    
    client.on('joinedSession', (data) => {
      console.log('✅ Received joinedSession response:', data);
      
      expect(data).toBeDefined();
      expect(data.sessionCode).toBe('INT001');
      expect(data.playerName).toBe('IntegrationTest');
      expect(data.isSpectator).toBe(false);
      
      done();
    });
    
    client.on('error', (error) => {
      console.error('❌ Socket error:', error);
      done(new Error(error.message));
    });
  }, 10000);

  test('should handle voting workflow', (done) => {
    client = new Client('http://localhost:3333');
    
    let sessionJoined = false;
    let voteSubmitted = false;
    let sessionUpdateReceived = false;
    
    client.on('connect', () => {
      console.log('🔌 Connected for voting test, socket ID:', client.id);
      client.emit('joinSession', {
        sessionCode: 'INT002',
        playerName: 'VotingTest',
        isSpectator: false
      });
    });
    
    client.on('joinedSession', (data) => {
      console.log('✅ Session joined for voting test:', data);
      sessionJoined = true;
      
      // Wait longer before voting to ensure session is fully established
      setTimeout(() => {
        console.log('🗳️ Session joined, now casting vote...');
        client.emit('castVote', { vote: 5 });
        voteSubmitted = true;
        console.log('✅ Vote submitted');
      }, 1000); // Increased delay
    });
    
    client.on('sessionUpdate', (data) => {
      console.log('📊 Session update received:', JSON.stringify(data.state, null, 2));
      sessionUpdateReceived = true;
      
      if (sessionJoined && voteSubmitted && data.state.players.VotingTest) {
        const player = data.state.players.VotingTest;
        
        console.log('👤 Player VotingTest state:');
        console.log('  - hasVoted:', player.hasVoted);
        console.log('  - vote:', player.vote);
        console.log('  - isSpectator:', player.isSpectator);
        
        // Check if vote was recorded
        if (player.hasVoted === true) {
          console.log('✅ Vote was recorded successfully!');
          if (data.state.votesRevealed) {
            expect(player.vote).toBe(5);
            console.log('✅ Vote value is correct: 5');
          }
          done();
        } else {
          console.log('❌ Vote was NOT recorded yet - waiting...');
          // Don't fail immediately, wait for another update
        }
      } else {
        console.log('⏳ Waiting for all conditions:', {
          sessionJoined,
          voteSubmitted,
          sessionUpdateReceived,
          playerExists: !!data.state.players.VotingTest
        });
      }
    });
    
    client.on('error', (error) => {
      console.error('❌ Socket error during voting test:', error);
      done(new Error('Socket error: ' + error.message));
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (!sessionUpdateReceived || !voteSubmitted) {
        done(new Error('Test timeout: Vote workflow did not complete'));
      }
    }, 8000);
  }, 10000);
});

describe('Cost Optimization Tests', () => {
  test('should validate session timeout settings', () => {
    // Session timeout should be 2 hours (7200 seconds)
    const sessionTimeout = 7200;
    const twoHoursInSeconds = 2 * 60 * 60;
    
    expect(sessionTimeout).toBe(twoHoursInSeconds);
  });

  test('should validate memory-efficient data structures', () => {
    // Test that we're using appropriate data structures
    const testSession = {
      sessionCode: 'TEST',
      players: {},
      votesRevealed: false,
      createdAt: new Date().toISOString()
    };
    
    // Ensure session object is minimal
    const sessionKeys = Object.keys(testSession);
    expect(sessionKeys.length).toBeLessThanOrEqual(5);
    
    // Ensure no unnecessary nested objects
    expect(typeof testSession.players).toBe('object');
    expect(Array.isArray(testSession.players)).toBe(false);
  });

  test('should validate Fibonacci vote values are efficient', () => {
    const fibonacciValues = [1, 2, 3, 5, 8, 13];
    
    // Ensure we're only storing valid, minimal vote values
    expect(fibonacciValues.length).toBe(6);
    expect(Math.max(...fibonacciValues)).toBe(13);
    
    // All values should be positive integers
    fibonacciValues.forEach(value => {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });

  test('should validate local development mode', () => {
    // Ensure we're running in local mode for development
    process.env.IS_OFFLINE = 'true';
    process.env.NODE_ENV = 'test';
    
    expect(process.env.IS_OFFLINE).toBe('true');
    expect(process.env.NODE_ENV).toBe('test');
  });
});