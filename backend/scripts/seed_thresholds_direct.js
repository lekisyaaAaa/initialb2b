#!/usr/bin/env node
/*
  Direct seed script for Render jobs: inserts or updates the 'thresholds' settings row
  Uses local Sequelize setup in services/database_pg.js and the Settings model.
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const sequelize = require('../services/database_pg');
const Settings = require('../models/Settings');

async function run() {
  try {
    console.log('Connecting to DB...');
    await sequelize.authenticate();
    console.log('Connected.');

    const now = new Date();
    const payload = {
      temperature: { min: 20, max: 30 },
      moisture: { min: 60, max: 80 },
      ph: { min: 6.5, max: 7.5 },
      ec: { min: 1.5, max: 3.0 },
      nitrogen: { min: 800, max: 1500 },
      phosphorus: { min: 400, max: 800 },
      potassium: { min: 1000, max: 2000 },
      waterLevel: { min: 20, max: 40 },
      floatSensor: { safe: 1, unsafe: 0 }
    };

    const existing = await Settings.findOne({ where: { key: 'thresholds' } });
    if (existing) {
      console.log('Existing thresholds row found — updating.');
      existing.value = JSON.stringify(payload);
      existing.updatedAt = now;
      await existing.save();
      console.log('Updated thresholds row successfully.');
    } else {
      console.log('No thresholds row found — inserting new row.');
      await Settings.create({ key: 'thresholds', value: JSON.stringify(payload), createdAt: now, updatedAt: now });
      console.log('Inserted thresholds row successfully.');
    }

    console.log('✅ Seeder completed successfully.');
  } catch (err) {
    console.error('❌ Seeder failed:', err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    try {
      await sequelize.close();
      console.log('DB connection closed.');
    } catch (err) {}
  }
}

run();
