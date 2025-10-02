const sequelize = require('./database_pg');
const Settings = require('../models/Settings');
const User = require('../models/User');

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing Postgres database...');

    await sequelize.authenticate();
    console.log('\u2705 Connected to Postgres (Sequelize)');

    // In development, sync models lightly to ensure schema compatibility (no destructive force)
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      try {
        await sequelize.sync();
      } catch (e) {
        console.warn('Model sync warning:', e && e.message ? e.message : e);
      }
    }

    // Attempt to touch settings table to ensure migrations ran
    try {
      await Settings.findAll({ limit: 1 });
    } catch (e) {
      console.warn('Could not read settings table (it may be empty or not migrated yet):', e && e.message ? e.message : e);
    }

    // Note: user seeding is handled by `scripts/seed-admin.js` or server startup seeding
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error && (error.message || error));
    throw error;
  }
};

module.exports = {
  initializeDatabase
};
