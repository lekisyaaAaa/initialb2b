const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = require('../services/database_pg');
const User = require('../models/User');

async function inspect() {
  try {
    await sequelize.authenticate();
    const admin = await User.findOne({ where: { username: 'admin' }, raw: true });
    console.log('Admin row:', admin);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

inspect();
