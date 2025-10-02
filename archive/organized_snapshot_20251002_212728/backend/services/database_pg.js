const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Database reconnect configuration
const DB_RECONNECT_INTERVAL = 5000; // 5 seconds
const DB_MAX_RECONNECT_ATTEMPTS = 10;
let reconnectAttempts = 0;

// In development prefer a local SQLite DB for resilience when Postgres isn't available.
if ((process.env.NODE_ENV || 'development') !== 'production') {
	const storage = path.join(__dirname, '..', 'data', 'dev.sqlite');
	console.log(`Using SQLite dev DB at ${storage}`);
	const sequelize = new Sequelize({
		dialect: 'sqlite',
		storage,
		logging: false,
		pool: {
			max: 5,
			min: 0,
			acquire: 30000,
			idle: 10000
		}
	});
	module.exports = sequelize;
} else {
	const sequelize = new Sequelize(process.env.DATABASE_URL, {
		dialect: 'postgres',
		logging: false,
		dialectOptions: {
			ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
		},
		pool: {
			max: 5,
			min: 0,
			acquire: 30000,
			idle: 10000
		},
		retry: {
			max: 3
		}
	});

	// Add reconnect logic for PostgreSQL
	const attemptReconnect = async () => {
		try {
			await sequelize.authenticate();
			console.log('✅ PostgreSQL reconnected successfully');
			reconnectAttempts = 0;
		} catch (error) {
			reconnectAttempts++;
			console.error(`❌ PostgreSQL reconnect attempt ${reconnectAttempts}/${DB_MAX_RECONNECT_ATTEMPTS} failed:`, error.message);

			if (reconnectAttempts < DB_MAX_RECONNECT_ATTEMPTS) {
				setTimeout(attemptReconnect, DB_RECONNECT_INTERVAL);
			} else {
				console.error('❌ Max PostgreSQL reconnect attempts reached. Server will continue without database.');
			}
		}
	};

	// Handle connection loss
	sequelize.connectionManager.on('error', (error) => {
		console.error('❌ PostgreSQL connection error:', error.message);
		if (reconnectAttempts === 0) {
			attemptReconnect();
		}
	});

	module.exports = sequelize;
}
