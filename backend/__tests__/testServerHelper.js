const app = require('../test-utils/testServerHelper');

test('testServerHelper sanity', () => {
  expect(app).toBeDefined();
  expect(typeof app).toBe('function');
});

module.exports = app;
