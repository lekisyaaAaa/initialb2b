#!/usr/bin/env node
/*
  check_thresholds.js
  Simple script to run inside the Render service to print the 'thresholds' settings row
  and the column type for settings.value. Intended to be run as a one-off Render job.
*/

const path = require('path');

async function main() {
  // Ensure we load project env and sequelize configuration
  const db = require(path.join(__dirname, '..', 'services', 'database_pg'));

  try {
    console.log('Connecting to DB...');
    if (db.connectDB) {
      await db.connectDB();
    }

    const Settings = require(path.join(__dirname, '..', 'models', 'Settings'));

    console.log('Querying settings for key=thresholds...');
    const row = await Settings.findOne({ where: { key: 'thresholds' } });

    if (!row) {
      console.log('No settings row found with key=thresholds');
    } else {
      console.log('settings.key =', row.key);
      try {
        const parsed = JSON.parse(row.value);
        console.log('settings.value (JSON) =', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('settings.value (raw) =', row.value);
      }
    }

    // Print the column type for settings.value from information_schema
    const sequelize = require(path.join(__dirname, '..', 'services', 'database_pg'));
    const rawQuery = `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='settings' AND column_name='value'`;
    const [results] = await sequelize.query(rawQuery, { raw: true });
    if (results && results.length > 0) {
      console.log('Column type for settings.value:', results[0]);
    } else {
      console.log('Could not determine column type for settings.value');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking thresholds:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
