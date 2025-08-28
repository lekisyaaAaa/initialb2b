const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = require('./services/database_pg');
const SensorData = require('./models/SensorData');
const Alert = require('./models/Alert');
const Settings = require('./models/Settings');

async function populateDB() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('✅ Connected to PostgreSQL');

    // Delete existing data
    await SensorData.destroy({ where: {} });
    await Alert.destroy({ where: {} });
    await Settings.destroy({ where: {} });
    console.log('🗑️ Cleared SensorData, Alert, and Settings tables');

    // Insert sample sensor data
    await SensorData.create({
      sensorId: 'esp32-001',
      value: 25.5,
      timestamp: new Date(),
    });
    console.log('✅ Sample sensor data inserted');

    // Insert default settings
    await Settings.create({
      key: 'default_temp_threshold',
      value: '30',
    });
    console.log('✅ Default settings inserted');

    // Insert sample alert
    await Alert.create({
      type: 'temperature',
      message: 'Temperature threshold exceeded',
      createdAt: new Date(),
    });
    console.log('✅ Sample alert inserted');

    console.log('🎉 Database populated successfully!');
  } catch (error) {
    console.error('❌ Error populating database:', error);
  } finally {
    await sequelize.close();
    console.log('� Disconnected from PostgreSQL');
    process.exit(0);
  }
}

populateDB();
