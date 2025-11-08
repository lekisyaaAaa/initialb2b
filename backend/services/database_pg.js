const { Sequelize } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

const rawNodeEnv = (process.env.NODE_ENV || '').toLowerCase();
const isTestEnv = rawNodeEnv === 'test' || Boolean(process.env.JEST_WORKER_ID);
const envFile = isTestEnv ? '.env.test' : '.env';

dotenv.config({ path: path.join(__dirname, '..', envFile), override: true });

const baseOptions = {
	logging: false,
	pool: {
		max: Number(process.env.DB_POOL_MAX || 5),
		min: Number(process.env.DB_POOL_MIN || 0),
		acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
		idle: Number(process.env.DB_POOL_IDLE || 10000)
	}
};

let sequelize;
let currentDialect = 'postgres';
let usesSsl = false;

if (isTestEnv) {
	// Use SQLite in-memory DB to keep tests hermetic and fast.
	sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: process.env.SQLITE_STORAGE || ':memory:',
		logging: false
	});
	currentDialect = 'sqlite';
} else {
	const databaseUrl = process.env.DATABASE_URL || '';
	const sslFlagFromUrl = /[?&]sslmode=require/i.test(databaseUrl);
	const sslFlagFromEnv = (process.env.PGSSLMODE || '').toLowerCase() === 'require';
	const shouldRequireSsl = sslFlagFromUrl || sslFlagFromEnv;
	usesSsl = shouldRequireSsl;

	if (!process.env.DATABASE_URL) {
		logger.fatal('DATABASE_URL is required but missing. Set a PostgreSQL connection string in your environment.');
		process.exit(1);
	}

	const dialectOptions = shouldRequireSsl
		? { ssl: { require: true, rejectUnauthorized: false } }
		: {};

	sequelize = new Sequelize(process.env.DATABASE_URL, {
		...baseOptions,
		dialect: 'postgres',
		dialectOptions,
	});
}

function loadModels() {
	require('../models/User');
	require('../models/Device');
	require('../models/SensorData');
	require('../models/Alert');
	require('../models/Settings');
	require('../models/Actuator');
	require('../models/ActuatorLog');
	require('../models/DevicePort');
	require('../models/DeviceCommand');
	require('../models').Command;
	require('../models/Admin');
	require('../models/Otp');
	require('../models/UserSession');
	require('../models/PasswordResetToken');
	require('../models/SystemTest');
}

let setupPromise = null;

async function ensureDatabaseSetup(options = {}) {
	if (setupPromise) {
		return setupPromise;
	}

	loadModels();

	const syncOptions = {};
	if (options.force || isTestEnv) {
		syncOptions.force = true;
	}

	if (!syncOptions.force) {
		syncOptions.alter = options.alter ?? true;
	}

	logger.info('Syncing database schema', { force: Boolean(syncOptions.force), alter: Boolean(syncOptions.alter) });

	setupPromise = sequelize.sync(syncOptions).catch((err) => {
		setupPromise = null;
		throw err;
	});

	return setupPromise;
}

const connectDB = async () => {
	try {
		await sequelize.authenticate();
		currentDialect = sequelize.getDialect();
		logger.info(`✅ Connected to Render PostgreSQL (SSL mode: ${usesSsl ? 'require' : 'disabled'})`);
	} catch (error) {
		logger.error('Unable to connect to the database:', error.message);
		logger.error('Verify DATABASE_URL and ensure the PostgreSQL service is reachable.');
		throw error;
	}
};

module.exports = sequelize;
module.exports.connectDB = connectDB;
module.exports.getActiveDialect = () => currentDialect;
module.exports.ensureDatabaseSetup = ensureDatabaseSetup;
module.exports.getSslMode = () => (usesSsl ? 'require' : 'disabled');
