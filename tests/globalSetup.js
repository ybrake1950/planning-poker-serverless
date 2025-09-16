// tests/globalSetup.js
// Global setup that runs once before all tests
// Directory: root project folder (planning-poker-serverless/)

module.exports = async () => {
  console.log("🧪 Setting up test environment...");

  // Set global test environment variables
  process.env.NODE_ENV = "test";
  process.env.IS_OFFLINE = "true";

  // Any global setup logic here
  console.log("✅ Test environment ready");
};
