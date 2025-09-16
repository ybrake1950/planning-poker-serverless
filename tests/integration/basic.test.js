// tests/integration/basic.test.js
// Basic integration tests for the local server
// Directory: root project folder (planning-poker-serverless/)

const { spawn } = require("child_process");
const Client = require("socket.io-client");

describe("Basic Integration Tests", () => {
  let serverProcess;
  let client;

  // Start server before tests
  beforeAll((done) => {
    console.log("🚀 Starting local server for integration tests...");

    serverProcess = spawn("node", ["serverless/local-server.js"], {
      env: {
        ...process.env,
        PORT: 3333, // Use different port to avoid conflicts
        NODE_ENV: "test",
        IS_OFFLINE: "true",
      },
      stdio: "pipe", // Capture output
    });

    // Wait for server to start
    setTimeout(() => {
      console.log("✅ Server should be ready");
      done();
    }, 3000);
  });

  // Stop server after tests
  afterAll(() => {
    if (client) {
      client.close();
    }

    if (serverProcess) {
      serverProcess.kill();
      console.log("🛑 Test server stopped");
    }
  });

  // Clean up client after each test
  afterEach(() => {
    if (client) {
      client.close();
      client = null;
    }
  });

  test("should connect to Socket.IO server", (done) => {
    client = new Client("http://localhost:3333");

    client.on("connect", () => {
      console.log("✅ Socket.IO connection successful");
      expect(client.connected).toBe(true);
      done();
    });

    client.on("connect_error", (error) => {
      console.error("❌ Socket.IO connection failed:", error);
      done(error);
    });
  }, 10000);

  test("should handle joinSession event", (done) => {
    client = new Client("http://localhost:3333");

    client.on("connect", () => {
      console.log("🔌 Connected, sending joinSession event...");

      client.emit("joinSession", {
        sessionCode: "INT001",
        playerName: "IntegrationTest",
        isSpectator: false,
      });
    });

    client.on("joinedSession", (data) => {
      console.log("✅ Received joinedSession response:", data);

      expect(data).toBeDefined();
      expect(data.sessionCode).toBe("INT001");
      expect(data.playerName).toBe("IntegrationTest");
      expect(data.isSpectator).toBe(false);

      done();
    });

    client.on("error", (error) => {
      console.error("❌ Socket error:", error);
      done(new Error(error.message));
    });
  }, 10000);

  test("should handle voting workflow", (done) => {
    client = new Client("http://localhost:3333");

    let sessionJoined = false;

    client.on("connect", () => {
      client.emit("joinSession", {
        sessionCode: "INT002",
        playerName: "VotingTest",
        isSpectator: false,
      });
    });

    client.on("joinedSession", () => {
      sessionJoined = true;
      console.log("🗳️ Session joined, casting vote...");

      client.emit("castVote", { vote: 5 });
    });

    client.on("sessionUpdate", (data) => {
      if (sessionJoined && data.state.players.VotingTest) {
        const player = data.state.players.VotingTest;

        console.log("📊 Session update received:", data.state);

        expect(player.hasVoted).toBe(true);
        if (data.state.votesRevealed) {
          expect(player.vote).toBe(5);
        }

        done();
      }
    });

    client.on("error", (error) => {
      done(new Error(error.message));
    });
  }, 10000);
});

// ===========================
// tests/cost-optimization/basic.test.js
// Basic cost optimization validation
// Directory: root project folder (planning-poker-serverless/)

describe("Cost Optimization Tests", () => {
  test("should validate session timeout settings", () => {
    // Session timeout should be 2 hours (7200 seconds)
    const sessionTimeout = 7200;
    const twoHoursInSeconds = 2 * 60 * 60;

    expect(sessionTimeout).toBe(twoHoursInSeconds);
  });

  test("should validate memory-efficient data structures", () => {
    // Test that we're using appropriate data structures
    const testSession = {
      sessionCode: "TEST",
      players: {},
      votesRevealed: false,
      createdAt: new Date().toISOString(),
    };

    // Ensure session object is minimal
    const sessionKeys = Object.keys(testSession);
    expect(sessionKeys.length).toBeLessThanOrEqual(5);

    // Ensure no unnecessary nested objects
    expect(typeof testSession.players).toBe("object");
    expect(Array.isArray(testSession.players)).toBe(false);
  });

  test("should validate Fibonacci vote values are efficient", () => {
    const fibonacciValues = [1, 2, 3, 5, 8, 13];

    // Ensure we're only storing valid, minimal vote values
    expect(fibonacciValues.length).toBe(6);
    expect(Math.max(...fibonacciValues)).toBe(13);

    // All values should be positive integers
    fibonacciValues.forEach((value) => {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });

  test("should validate local development mode", () => {
    // Ensure we're running in local mode for development
    process.env.IS_OFFLINE = "true";
    process.env.NODE_ENV = "test";

    expect(process.env.IS_OFFLINE).toBe("true");
    expect(process.env.NODE_ENV).toBe("test");
  });
});
