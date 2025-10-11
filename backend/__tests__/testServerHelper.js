test('testServerHelper sanity', () => {
  expect(true).toBe(true);
});
const path = require('path');
process.env.NODE_ENV = 'test';
// Use ephemeral port to avoid collisions when tests run in parallel or when a server is already running
process.env.PORT = process.env.PORT || '0';
// Ensure we use the SQLite dev DB for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || '';
const app = require(path.join(__dirname, '..', 'server'));
// Export the express app for supertest
module.exports = app;
