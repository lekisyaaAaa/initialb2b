const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Settings = sequelize.define('Settings', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'settings',
  timestamps: false,
});

// Static method to get all settings as a structured object
Settings.getSettings = async () => {
  try {
    const settings = await Settings.findAll();
    const settingsObj = {};

    settings.forEach(setting => {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch (e) {
        settingsObj[setting.key] = setting.value;
      }
    });

    // Set defaults if not found
    if (!settingsObj.thresholds) {
      settingsObj.thresholds = {
        temperature: { warning: 30, critical: 35 },
        humidity: { warning: 80, critical: 90 },
        moisture: { warning: 20, critical: 10 },
        batteryLevel: { warning: 20, critical: 10 },
        ph: { minWarning: 6.0, minCritical: 5.5, maxWarning: 7.5, maxCritical: 8.0 },
        ec: { warning: 2.0, critical: 3.0 },
        nitrogen: { minWarning: 50, minCritical: 30 },
        phosphorus: { minWarning: 20, minCritical: 10 },
        potassium: { minWarning: 100, minCritical: 50 },
        waterLevel: { critical: 0 } // 0 means no water
      };
    }

    if (!settingsObj.monitoring) {
      settingsObj.monitoring = {
        dataCollectionInterval: 30,
        dataRetentionDays: 30
      };
    }

    if (!settingsObj.system) {
      settingsObj.system = {
        timezone: 'UTC'
      };
    }

    return settingsObj;
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

module.exports = Settings;
