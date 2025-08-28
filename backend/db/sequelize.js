const { Sequelize } = require('sequelize');
const path = require('path');
// Load env from backend .env if present
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Prefer explicit env var, fall back to local Postgres on port 5075 which the server is using
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5075/beantobin';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {}
});

module.exports = sequelize;
