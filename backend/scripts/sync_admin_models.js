const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = require('../services/database_pg');
const Admin = require('../models/Admin');
const AdminOTP = require('../models/AdminOTP');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database, syncing admin models...');
    await Admin.sync();
    await AdminOTP.sync();
    console.log('✅ Admin models synced');
    process.exit(0);
  } catch (err) {
    console.error('Failed to sync admin models:', err && err.message ? err.message : err);
    if (err && err.errors) {
      err.errors.forEach((e, idx) => {
        console.error(`  [${idx}]`, e.message);
      });
    }
    process.exit(1);
  }
})();
