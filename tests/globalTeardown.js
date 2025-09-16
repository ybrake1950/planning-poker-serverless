// tests/globalTeardown.js  
// Global teardown that runs once after all tests
// Directory: planning-poker-serverless/tests/

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Any global cleanup logic here
  console.log('✅ Test environment cleaned up');
};