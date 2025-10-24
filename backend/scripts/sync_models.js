// Sync Sequelize models (development only). Usage: node backend/scripts/sync_models.js
const sequelize = require('../services/database_pg');
(async () => {
  try {
    // require models so they are registered
  require('../models/Device');
  require('../models/Alert');
  require('../models/SensorData');
  require('../models/User');
  require('../models/Actuator');
  require('../models/ActuatorLog');
  require('../models/Settings');
    await sequelize.sync({ alter: true });
    console.log('✅ Models synced (alter: true)');
    process.exit(0);
  } catch (e) {
    console.error('Failed to sync models:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
