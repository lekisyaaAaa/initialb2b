/*
// LEGACY: migrate-users-to-pg.js
// This migration script was removed from the runnable tree as part of the
// Postgres-only cleanup (Option A). The original script is preserved in the
// repository history (use `git log -- backend/legacy_migrations/migrate-users-to-pg.js`)
// and can be restored if you need to run a MongoDB -> Postgres migration.
// If you intentionally need to run it, restore from git history and set
// MONGODB_URI in your environment before running.
*/
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const sequelize = require('../db/sequelize');
const SQLUser = require('../models_sql/User');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/beantobin_environmental_monitoring';

async function run() {
  console.log('Connecting to Postgres...');
  await sequelize.authenticate();
  console.log('Postgres authenticated');
  await SQLUser.sync({ alter: true });

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  const MongoUser = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');

  const users = await MongoUser.find({}).lean();
  console.log('Found', users.length, 'users in MongoDB');

  let created = 0;
  for (const u of users) {
    try {
      const exists = await SQLUser.findOne({ where: { username: u.username } });
      if (exists) continue;

      let password = u.password || '';
      if (!password.startsWith('$2')) {
        password = await bcrypt.hash(password || 'changeme', 10);
      }

      await SQLUser.create({
        username: u.username,
        password,
        role: u.role || 'user',
        isActive: (typeof u.isActive === 'boolean') ? u.isActive : true,
        lastLogin: u.lastLogin || null,
        loginCount: u.loginCount || 0
      });
      created++;
    } catch (err) {
      console.error('Error migrating user', u.username, err.message);
    }
  }

  console.log(`Migration complete. ${created} users created.`);
  await mongoose.disconnect();
  await sequelize.close();
}

run().catch(err => { console.error(err); process.exit(1); });
