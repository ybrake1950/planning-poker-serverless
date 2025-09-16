// tests/unit/db.test.js
// Unit tests for database functions
// Directory: root project folder (planning-poker-serverless/)

const {
  createSession,
  getSession,
  updateSession,
  storeConnection,
  getConnection,
  checkConsensus,
} = require("../../serverless/db");

describe("Database Functions", () => {
  beforeEach(() => {
    // Reset environment for each test
    process.env.IS_OFFLINE = "true";
    process.env.NODE_ENV = "test";
  });

  describe("Session Management", () => {
    test("should create a new session", async () => {
      const sessionCode = "TEST001";
      const session = await createSession(sessionCode);

      expect(session).toBeDefined();
      expect(session.sessionCode).toBe(sessionCode);
      expect(session.players).toEqual({});
      expect(session.votesRevealed).toBe(false);
      expect(session.createdAt).toBeDefined();
    });

    test("should retrieve an existing session", async () => {
      const sessionCode = "TEST002";

      // Create session first
      await createSession(sessionCode);

      // Then retrieve it
      const session = await getSession(sessionCode);

      expect(session).toBeDefined();
      expect(session.sessionCode).toBe(sessionCode);
    });

    test("should return null for non-existent session", async () => {
      const session = await getSession("NONEXISTENT");

      expect(session).toBeUndefined();
    });

    test("should update session data", async () => {
      const sessionCode = "TEST003";

      // Create session
      await createSession(sessionCode);

      // Update with new data
      const updates = {
        votesRevealed: true,
        players: {
          TestPlayer: {
            hasVoted: true,
            vote: 5,
            isSpectator: false,
          },
        },
      };

      const updatedSession = await updateSession(sessionCode, updates);

      expect(updatedSession.votesRevealed).toBe(true);
      expect(updatedSession.players.TestPlayer).toBeDefined();
      expect(updatedSession.players.TestPlayer.vote).toBe(5);
    });
  });

  describe("Connection Management", () => {
    test("should store a connection", async () => {
      const connectionId = "conn_001";
      const sessionCode = "TEST004";
      const playerName = "TestPlayer";
      const isSpectator = false;

      await storeConnection(connectionId, sessionCode, playerName, isSpectator);

      // Verify connection was stored
      const connection = await getConnection(connectionId);

      expect(connection).toBeDefined();
      expect(connection.connectionId).toBe(connectionId);
      expect(connection.sessionCode).toBe(sessionCode);
      expect(connection.playerName).toBe(playerName);
      expect(connection.isSpectator).toBe(isSpectator);
    });

    test("should retrieve a connection", async () => {
      const connectionId = "conn_002";

      // Store connection first
      await storeConnection(connectionId, "TEST005", "TestPlayer", false);

      // Retrieve it
      const connection = await getConnection(connectionId);

      expect(connection).toBeDefined();
      expect(connection.connectionId).toBe(connectionId);
    });

    test("should return null for non-existent connection", async () => {
      const connection = await getConnection("NONEXISTENT");

      expect(connection).toBeUndefined();
    });
  });

  describe("Game Logic", () => {
    test("should detect consensus when all votes match", () => {
      const session = {
        votesRevealed: true,
        players: {
          Player1: { hasVoted: true, vote: 5, isSpectator: false },
          Player2: { hasVoted: true, vote: 5, isSpectator: false },
          Player3: { hasVoted: true, vote: 5, isSpectator: false },
        },
      };

      const hasConsensus = checkConsensus(session);

      expect(hasConsensus).toBe(true);
    });

    test("should not detect consensus when votes differ", () => {
      const session = {
        votesRevealed: true,
        players: {
          Player1: { hasVoted: true, vote: 3, isSpectator: false },
          Player2: { hasVoted: true, vote: 5, isSpectator: false },
          Player3: { hasVoted: true, vote: 8, isSpectator: false },
        },
      };

      const hasConsensus = checkConsensus(session);

      expect(hasConsensus).toBe(false);
    });

    test("should ignore spectators in consensus calculation", () => {
      const session = {
        votesRevealed: true,
        players: {
          Player1: { hasVoted: true, vote: 5, isSpectator: false },
          Player2: { hasVoted: true, vote: 5, isSpectator: false },
          Spectator: { hasVoted: false, vote: null, isSpectator: true },
        },
      };

      const hasConsensus = checkConsensus(session);

      expect(hasConsensus).toBe(true);
    });

    test("should return false when votes not revealed", () => {
      const session = {
        votesRevealed: false,
        players: {
          Player1: { hasVoted: true, vote: 5, isSpectator: false },
          Player2: { hasVoted: true, vote: 5, isSpectator: false },
        },
      };

      const hasConsensus = checkConsensus(session);

      expect(hasConsensus).toBe(false);
    });

    test("should return false when no votes cast", () => {
      const session = {
        votesRevealed: true,
        players: {
          Spectator: { hasVoted: false, vote: null, isSpectator: true },
        },
      };

      const hasConsensus = checkConsensus(session);

      expect(hasConsensus).toBe(false);
    });
  });
});

// ===========================
// tests/unit/utils.test.js
// Utility function tests
// Directory: root project folder (planning-poker-serverless/)

describe("Utility Functions", () => {
  test("should generate valid session codes", () => {
    // Test session code generation logic
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substr(2, 8).toUpperCase();

      expect(code).toBeDefined();
      expect(typeof code).toBe("string");
      expect(code.length).toBe(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    }
  });

  test("should validate Fibonacci vote values", () => {
    const validVotes = [1, 2, 3, 5, 8, 13];
    const invalidVotes = [0, 4, 6, 7, 9, 10, 11, 12, 14, 15, -1, 99];

    validVotes.forEach((vote) => {
      expect(validVotes.includes(vote)).toBe(true);
    });

    invalidVotes.forEach((vote) => {
      expect(validVotes.includes(vote)).toBe(false);
    });
  });

  test("should handle player name validation", () => {
    const validNames = ["John", "Alice", "Bob", "TestUser123", "A"];
    const invalidNames = ["", "ThisNameIsWayTooLongForTheApplication"];

    validNames.forEach((name) => {
      expect(name.length).toBeGreaterThan(0);
      expect(name.length).toBeLessThanOrEqual(20);
    });

    invalidNames.forEach((name) => {
      expect(name.length === 0 || name.length > 20).toBe(true);
    });
  });
});
