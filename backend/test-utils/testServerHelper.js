const path = require('path');

process.env.NODE_ENV = 'test';
// Give Jest its own port to avoid clashing with dev instances.
process.env.PORT = '0';
// Provide safe fallbacks for all envs validateEnv expects so tests work without a .env file.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:bN8%23t7QpV4%21s2Z@127.0.0.1:5075/beantobin_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.test.local';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'Test <test@example.com>';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:3000';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS;
process.env.SOCKETIO_CORS_ORIGINS = process.env.SOCKETIO_CORS_ORIGINS || process.env.CORS_ORIGINS;
process.env.ESP32_URL = process.env.ESP32_URL || 'http://127.0.0.1';

const app = require(path.join(__dirname, '..', 'server'));

const shutdownServer = () => {
	if (app && app.server && typeof app.server.close === 'function') {
		try {
			app.server.close();
		} catch (e) {}
	}
};

if (typeof afterAll === 'function') {
	afterAll(() => {
		shutdownServer();
	});
}

if (typeof process !== 'undefined' && typeof process.on === 'function') {
	process.on('exit', () => {
		shutdownServer();
	});
}

module.exports = app;
