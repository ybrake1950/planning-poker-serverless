/ tests/globalTeardown.js  
// Global teardown that runs once after all tests
// Directory: root project folder (planning-poker-serverless/)

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Any global cleanup logic here
  console.log('✅ Test environment cleaned up');
};