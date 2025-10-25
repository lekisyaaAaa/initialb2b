const path = require('path');
process.env.NODE_ENV = 'test';
// Use ephemeral port to avoid collisions
process.env.PORT = process.env.PORT || '0';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/beantobin_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.test.local';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'Test <test@example.com>';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.ESP32_URL = process.env.ESP32_URL || 'http://127.0.0.1';
const app = require(path.join(__dirname, '..', 'server'));
module.exports = app;
