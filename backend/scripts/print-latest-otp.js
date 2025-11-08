const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const sequelize = require('../services/database_pg');
const Admin = require('../models/Admin');

(async () => {
  try {
    await sequelize.authenticate();
    await Admin.sync();

    const admin = await Admin.findOne({ where: {}, order: [['createdAt', 'DESC']] });
    if (!admin) {
      console.log('No admin account found.');
      process.exit(0);
    }

    console.log('Latest OTP info for', admin.email);
    console.log(' otpHash:', admin.otpHash || '<none>');
    console.log(' otpExpiresAt:', admin.otpExpiresAt || '<none>');
    console.log('Note: OTP values are stored as bcrypt hashes and cleared once verified. Ensure EMAIL_* env vars are configured for delivery.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to inspect OTP:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
