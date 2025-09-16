// jest.config.js
// Comprehensive Jest configuration for Planning Poker test suite
// Directory: root project folder (planning-poker/)

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/server/tests/**/*.test.js',
    '**/client/tests/**/*.test.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Coverage collection
  collectCoverageFrom: [
    'server/src/**/*.js',
    'client/src/**/*.js',
    '!server/src/index.js', // Exclude main entry point
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  // Coverage thresholds for CI/CD
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './server/src/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Coverage reporting
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // Test timeout (important for integration/e2e tests)
  testTimeout: 30000,
  
  // Test projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.js',
        '<rootDir>/server/tests/**/*.test.js'
      ],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'client',
      testMatch: ['<rootDir>/client/tests/**/*.test.js'],
      testEnvironment: 'jsdom'
    }
  ],
  
  // Module name mapping for client-side tests
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/client/src/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Verbose output for CI
  verbose: true
};
