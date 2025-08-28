const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = require('../services/database_pg');
const User = require('../models/User');

async function activateAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      console.log('Admin user not found');
      process.exit(1);
    }

    await admin.update({ isActive: true });
    console.log('Admin activated:', admin.username);
    process.exit(0);
  } catch (err) {
    console.error('Error activating admin:', err);
    process.exit(1);
  }
}

activateAdmin();
