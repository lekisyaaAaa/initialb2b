const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = require('../services/database_pg');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function main() {
  const adminUser = process.env.LOCAL_ADMIN_USER || 'admin';
  const adminPass = process.env.LOCAL_ADMIN_PASS || 'admin123';

  try {
    console.log('Connecting to Postgres...');
    await sequelize.authenticate();
    console.log('Connected to Postgres');

    // Ensure models are synced (non-destructive)
    await sequelize.sync();

    // Hash password and upsert user
    const hash = bcrypt.hashSync(adminPass, 10);

    const [user, created] = await User.findOrCreate({
      where: { username: adminUser },
      defaults: { password: hash, role: 'admin' }
    });

    if (!created) {
      // Update password in case it changed
      if (user.password !== hash) {
        user.password = hash;
        await user.save();
        console.log(`Updated password for existing user '${adminUser}'`);
      } else {
        console.log(`Admin user '${adminUser}' already exists`);
      }
    } else {
      console.log(`Created admin user '${adminUser}'`);
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed admin user:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
