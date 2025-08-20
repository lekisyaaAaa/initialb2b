const mongoose = require('mongoose');
const User = require('../models/User');
const Settings = require('../models/Settings');

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');
    
    // Wait for MongoDB connection
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('connected', resolve);
      }
    });

    // Create default users
    await User.createDefaultUsers();

    // Initialize default settings
    await Settings.getSettings();

    console.log('✅ Database initialization completed');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

module.exports = {
  initializeDatabase
};
