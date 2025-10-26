const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const bcrypt = require('bcryptjs');
const sequelize = require('./services/database_pg');
const User = require('./models/User');

async function createUsers() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('✅ Connected to PostgreSQL');

    // Delete existing users to start fresh
    await User.destroy({ where: {} });
    console.log('🗑️ Cleared existing users');

    const adminUsername = (process.env.ADMIN_LOGIN_USERNAME || process.env.EMAIL_USER || '').trim();
    const adminPassword = process.env.ADMIN_LOGIN_PASSWORD || process.env.EMAIL_PASS || '';

    if (!adminUsername || !adminPassword) {
      throw new Error('Admin credentials are not configured. Set ADMIN_LOGIN_USERNAME and ADMIN_LOGIN_PASSWORD (or EMAIL_USER/EMAIL_PASS).');
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await User.create({
      username: adminUsername,
      password: hashedPassword,
      role: 'admin',
    });
    console.log(`✅ Admin user created for ${adminUsername}`);

    console.log('🎉 Admin user created successfully!');
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await sequelize.close();
    console.log('👋 Disconnected from PostgreSQL');
    process.exit(0);
  }
}

createUsers();
