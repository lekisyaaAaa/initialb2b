const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const { Sequelize } = require('sequelize');

async function deleteTestSensorData() {
  let sequelize;

  // Try PostgreSQL first (production)
  try {
    const pg = require('../services/database_pg');
    sequelize = pg;
    console.log('Using PostgreSQL...');
  } catch (pgErr) {
    console.log('PostgreSQL not available, using SQLite...');
    // Fall back to SQLite (development)
    const storagePath = path.join(__dirname, '..', 'data', 'dev.sqlite');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: storagePath,
      logging: false
    });
  }

  try {
    // Define the SensorData model
    const SensorData = sequelize.define('SensorData', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      deviceId: { type: Sequelize.STRING, allowNull: false },
      temperature: { type: Sequelize.FLOAT },
      humidity: { type: Sequelize.FLOAT },
      moisture: { type: Sequelize.FLOAT },
      ph: { type: Sequelize.FLOAT },
      ec: { type: Sequelize.FLOAT },
      nitrogen: { type: Sequelize.FLOAT },
      phosphorus: { type: Sequelize.FLOAT },
      potassium: { type: Sequelize.FLOAT },
      waterLevel: { type: Sequelize.INTEGER },
      batteryLevel: { type: Sequelize.FLOAT },
      signalStrength: { type: Sequelize.INTEGER },
      timestamp: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    }, {
      tableName: 'SensorData',
      timestamps: false
    });

    // Authenticate and sync
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Delete test sensor data
    const deletedCount = await SensorData.destroy({
      where: {
        deviceId: 'esp32-test-01'
      }
    });

    console.log(`Deleted ${deletedCount} test sensor records`);

    // Also check if there are any other test records
    const remainingTestData = await SensorData.findAll({
      where: {
        deviceId: {
          [Sequelize.Op.like]: '%test%'
        }
      }
    });

    if (remainingTestData.length > 0) {
      console.log(`Found ${remainingTestData.length} other test records:`);
      remainingTestData.forEach(record => {
        console.log(`- ID: ${record.id}, Device: ${record.deviceId}`);
      });
    } else {
      console.log('No other test sensor data found');
    }

  } catch (error) {
    console.error('Error deleting test sensor data:', error);
  } finally {
    await sequelize.close();
  }
}

deleteTestSensorData();