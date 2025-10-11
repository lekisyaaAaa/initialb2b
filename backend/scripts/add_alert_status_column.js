// Add 'status' column to alerts table if missing. Safe to run multiple times.
// Usage: node backend/scripts/add_alert_status_column.js

const path = require('path');
const fs = require('fs');

async function main() {
  try {
    const Alert = require('../models/Alert');
    const sequelize = Alert.sequelize;
    const qi = sequelize.getQueryInterface();

    console.log('Checking alerts table schema...');
    const desc = await qi.describeTable('alerts');
    if (desc && desc.status) {
      console.log('Column `status` already exists. No action needed.');
      process.exit(0);
    }

    console.log('Adding `status` column to alerts table...');
    await qi.addColumn('alerts', 'status', {
      type: sequelize.Sequelize.ENUM('new','read'),
      allowNull: false,
      defaultValue: 'new',
    });

    console.log('Successfully added `status` column.');
    process.exit(0);
  } catch (err) {
    // Fallback for SQLite where ENUM may not be supported by addColumn via queryInterface
    try {
      const Alert = require('../models/Alert');
      const sequelize = Alert.sequelize;
      const qi = sequelize.getQueryInterface();
      const desc = await qi.describeTable('alerts');
      if (desc && desc.status) {
        console.log('Column `status` already exists (second check).');
        process.exit(0);
      }
      console.log('Attempting SQLite-safe ALTER TABLE to add `status` TEXT default "new"');
      // SQLite: ALTER TABLE ADD COLUMN status TEXT DEFAULT 'new'
      await sequelize.query("ALTER TABLE alerts ADD COLUMN status TEXT DEFAULT 'new'");
      console.log('Added status column with SQLite fallback.');
      process.exit(0);
    } catch (inner) {
      console.error('Failed to add `status` column:', inner);
      process.exit(2);
    }
  }
}

main();
