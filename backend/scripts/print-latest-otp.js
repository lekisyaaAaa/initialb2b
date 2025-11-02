const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const sequelize = require('../services/database_pg');
const Admin = require('../models/Admin');
const AdminOTP = require('../models/AdminOTP');

(async () => {
  try {
    await sequelize.authenticate();
    await Admin.sync();
    await AdminOTP.sync();

    const admin = await Admin.findOne({ where: {}, order: [['createdAt', 'DESC']] });
    if (!admin) {
      console.log('No admin account found.');
      process.exit(0);
    }

    const otp = await AdminOTP.findOne({ where: { adminId: admin.id }, order: [['createdAt', 'DESC']] });
    if (!otp) {
      console.log('No OTP entry found for admin email', admin.email);
      process.exit(0);
    }

    console.log('Latest OTP info for', admin.email);
    console.log(' consumed:', otp.consumed);
    console.log(' expiresAt:', otp.expiresAt);
    console.log(' attempts:', otp.attempts);
    console.log(' storedHash:', otp.otpHash);
    console.log('The actual code is not stored in plaintext for security. To test without email delivery, temporarily modify otpService.generateOtpCode to log the generated code.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to inspect OTP:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
