const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

const adminUser = process.env.LOCAL_ADMIN_USER || 'admin';
const adminPass = process.env.LOCAL_ADMIN_PASS || 'admin';

async function seedWithSequelize(sequelize, UserModel) {
  await sequelize.sync();
  const hash = bcrypt.hashSync(adminPass, 10);
  const [user, created] = await UserModel.findOrCreate({
    where: { username: adminUser },
    defaults: { password: hash, role: 'admin' }
  });

  if (!created) {
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
}

async function main() {
  // First try Postgres (existing configured service)
  try {
    const pg = require('../services/database_pg');
    const User = require('../models/User');
    console.log('Attempting to seed Postgres...');
    await pg.authenticate();
    console.log('Connected to Postgres');
    await seedWithSequelize(pg, User);
    console.log('Done seeding Postgres.');
    process.exit(0);
  } catch (pgErr) {
    console.warn('Postgres unavailable or seeding failed:', pgErr && pgErr.message ? pgErr.message : pgErr);
    console.log('Falling back to local SQLite dev DB at backend/data/dev.sqlite');
    try {
      const storagePath = path.join(__dirname, '..', 'data', 'dev.sqlite');
      const sqlite = new Sequelize({ dialect: 'sqlite', storage: storagePath, logging: false });
      const UserSql = sqlite.define('User', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        username: { type: DataTypes.STRING, allowNull: false, unique: true },
        password: { type: DataTypes.STRING, allowNull: false },
        role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'user' }
      }, { tableName: 'users', timestamps: false });

      await seedWithSequelize(sqlite, UserSql);
      console.log('Done seeding local SQLite dev DB.');
      process.exit(0);
    } catch (sqliteErr) {
      console.error('Failed to seed using SQLite fallback:', sqliteErr && sqliteErr.message ? sqliteErr.message : sqliteErr);
      process.exit(1);
    }
  }
}

main();
