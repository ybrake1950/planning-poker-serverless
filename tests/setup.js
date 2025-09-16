// tests/setup.js
// Test setup configuration that runs before each test
// Directory: root project folder (planning-poker-serverless/)

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.IS_OFFLINE = "true";

// Increase timeout for async tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Generate test session codes
  generateTestSessionCode: () =>
    "TEST" + Math.random().toString(36).substr(2, 4).toUpperCase(),

  // Common test data
  testPlayer: {
    name: "TestPlayer",
    isSpectator: false,
  },

  testSpectator: {
    name: "TestSpectator",
    isSpectator: true,
  },
};

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Suppress console output during tests unless DEBUG=true
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterEach(() => {
  // Restore console methods
  if (!process.env.DEBUG) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }

  // Clear all mocks
  jest.clearAllMocks();
});

// ===========================
