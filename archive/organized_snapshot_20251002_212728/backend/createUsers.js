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

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
    });
    console.log('✅ Admin user created: admin/admin123');

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
