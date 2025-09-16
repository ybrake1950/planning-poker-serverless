// jest.config.js
// Consolidated Jest configuration for all tests
// Directory: root project folder (planning-poker-serverless/)

module.exports = {
  // Test environment
  testEnvironment: "node",

  // Test file patterns
  testMatch: ["**/tests/**/*.test.js", "**/server/tests/**/*.test.js"],

  // Ignore patterns
  testPathIgnorePatterns: [
    "/node_modules/",
    "/client/node_modules/",
    "/server/node_modules/",
    "/client/dist/",
    "/client/build/",
  ],

  // Coverage configuration
  collectCoverage: false, // Only collect when explicitly requested
  collectCoverageFrom: [
    "server/src/**/*.js",
    "serverless/**/*.js",
    "!server/src/index.js", // Exclude main entry point
    "!**/node_modules/**",
  ],

  // Coverage directory
  coverageDirectory: "coverage",

  // Coverage reporters
  coverageReporters: ["text", "lcov", "html"],

  // Setup files (run before each test)
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Module directories
  moduleDirectories: ["node_modules", "<rootDir>"],

  // Test timeout (30 seconds for E2E tests)
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Transform configuration (if needed for ES6 modules)
  transform: {},

  // Global setup/teardown
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
};
