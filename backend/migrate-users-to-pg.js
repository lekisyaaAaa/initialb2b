/*
 Simple migration: copy users from MongoDB (Mongoose) to Postgres (Sequelize).
 Run from backend folder with DATABASE_URL set if needed.
*/
const sequelize = require('./db/sequelize');
const SQLUser = require('./models_sql/User');

module.exports = async function() {
  console.log('Legacy migration script removed.');
};
