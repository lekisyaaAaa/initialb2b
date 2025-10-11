const path = require('path');
process.env.NODE_ENV = 'test';
// Use ephemeral port to avoid collisions
process.env.PORT = process.env.PORT || '0';
const app = require(path.join(__dirname, '..', 'server'));
module.exports = app;
