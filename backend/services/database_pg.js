const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// In development prefer a local SQLite DB for resilience when Postgres isn't available.
if ((process.env.NODE_ENV || 'development') !== 'production') {
	const storage = path.join(__dirname, '..', 'data', 'dev.sqlite');
	console.log(`Using SQLite dev DB at ${storage}`);
	const sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });
	module.exports = sequelize;
} else {
	const sequelize = new Sequelize(process.env.DATABASE_URL, {
		dialect: 'postgres',
		logging: false,
		dialectOptions: {
			ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
		},
	});
	module.exports = sequelize;
}
