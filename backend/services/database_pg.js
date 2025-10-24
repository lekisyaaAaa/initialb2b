const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Ensure we load the backend-specific .env file.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

const baseOptions = {
	logging: false,
	pool: {
		max: Number(process.env.DB_POOL_MAX || 5),
		min: Number(process.env.DB_POOL_MIN || 0),
		acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
		idle: Number(process.env.DB_POOL_IDLE || 10000)
	}
};

const preferSqlite = (() => {
	const flag = (process.env.USE_SQLITE || process.env.DB_DIALECT || '').toString().toLowerCase();
	return flag === 'true' || flag === '1' || flag === 'sqlite';
})();

const useConnectionUrl = !preferSqlite && Boolean(process.env.DATABASE_URL && !process.env.DB_NAME);

const ensureSqliteStorage = () => {
	const storageDir = path.join(__dirname, '..', 'data');
	if (!fs.existsSync(storageDir)) {
		fs.mkdirSync(storageDir, { recursive: true });
	}
	return process.env.DB_STORAGE || path.join(storageDir, process.env.DB_SQLITE_FILENAME || 'dev.sqlite');
};

const createSqliteInstance = () => {
	const storage = ensureSqliteStorage();
	console.log(`Using SQLite dev DB at ${storage}`);
	return new Sequelize({
		...baseOptions,
		dialect: 'sqlite',
		storage
	});
};

const createPostgresInstance = () => {
	if (useConnectionUrl) {
		return new Sequelize(process.env.DATABASE_URL, {
			...baseOptions,
			dialect: 'postgres',
			dialectOptions: {
				ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
			}
		});
	}

	const dialect = (process.env.DB_DIALECT || 'postgres').toLowerCase();
	const connectionOptions = {
		...baseOptions,
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
		dialect,
		dialectOptions: {}
	};

	if (dialect === 'postgres' && process.env.PGSSLMODE === 'require') {
		connectionOptions.dialectOptions.ssl = { rejectUnauthorized: false };
	}

	return new Sequelize(
		process.env.DB_NAME,
		process.env.DB_USER,
		process.env.DB_PASS,
		connectionOptions
	);
};

let sequelize = preferSqlite ? createSqliteInstance() : createPostgresInstance();
let currentDialect = preferSqlite ? 'sqlite' : 'postgres';

const connectDB = async () => {
	try {
		await sequelize.authenticate();
		currentDialect = sequelize.getDialect();
		const connectionLabel = currentDialect === 'sqlite'
			? `sqlite://${ensureSqliteStorage()}`
			: (useConnectionUrl ? 'connection URL' : `${currentDialect}://${process.env.DB_HOST}:${process.env.DB_PORT || '(default port)'}`);
		console.log(`✅ Database connected successfully via ${connectionLabel}`);
	} catch (error) {
		console.error('❌ Unable to connect to the database:', error.message);
		if (!isProduction) {
			console.error('ℹ️  Check your backend/.env credentials or ensure the database service is running.');
		}
		throw error;
	}
};

module.exports = sequelize;
module.exports.connectDB = connectDB;
module.exports.getActiveDialect = () => currentDialect;
