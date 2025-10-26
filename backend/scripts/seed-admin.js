const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

const adminEmail = (process.env.INIT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || process.env.ADMIN_LOGIN_USERNAME || process.env.EMAIL_USER || '').trim();
const adminPassword = process.env.INIT_ADMIN_PASSWORD || process.env.ADMIN_LOGIN_PASSWORD || process.env.EMAIL_PASS;

if (!adminEmail || !adminPassword) {
  console.error('Admin credentials are not configured. Provide INIT_ADMIN_EMAIL/INIT_ADMIN_PASSWORD or ADMIN_LOGIN_USERNAME/ADMIN_LOGIN_PASSWORD (EMAIL_USER/EMAIL_PASS as fallback).');
  process.exit(1);
}

async function seedWithSequelize(sequelize, AdminModel) {
  await sequelize.sync();
  const hash = bcrypt.hashSync(adminPassword, 12);
  const [admin, created] = await AdminModel.findOrCreate({
    where: { email: adminEmail },
    defaults: { passwordHash: hash }
  });

  if (!created) {
    if (admin.passwordHash !== hash) {
      admin.passwordHash = hash;
      await admin.save();
      console.log(`Updated password for existing admin '${adminEmail}'`);
    } else {
      console.log(`Admin '${adminEmail}' already exists`);
    }
  } else {
    console.log(`Created admin '${adminEmail}'`);
  }
}

async function main() {
  // First try Postgres (existing configured service)
  try {
    const pg = require('../services/database_pg');
    const Admin = require('../models/Admin');
    console.log('Attempting to seed Postgres...');
    await pg.authenticate();
    console.log('Connected to Postgres');
    await seedWithSequelize(pg, Admin);
    console.log('Done seeding Postgres.');
    process.exit(0);
  } catch (pgErr) {
    console.warn('Postgres unavailable or seeding failed:', pgErr && pgErr.message ? pgErr.message : pgErr);
    console.log('Falling back to local SQLite dev DB at backend/data/dev.sqlite');
    try {
      const storagePath = path.join(__dirname, '..', 'data', 'dev.sqlite');
      const sqlite = new Sequelize({ dialect: 'sqlite', storage: storagePath, logging: false });
      const AdminSql = sqlite.define('Admin', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING, allowNull: false },
      }, { tableName: 'admins', timestamps: true, underscored: true });

      await seedWithSequelize(sqlite, AdminSql);
      console.log('Done seeding local SQLite dev DB.');
      process.exit(0);
    } catch (sqliteErr) {
      console.error('Failed to seed using SQLite fallback:', sqliteErr && sqliteErr.message ? sqliteErr.message : sqliteErr);
      process.exit(1);
    }
  }
}

main();
