const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Sequelize model for sensor readings. Fields align with the REST route payloads.
const SensorData = sequelize.define('SensorData', {
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  temperature: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  humidity: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  moisture: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  batteryLevel: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  signalStrength: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  isOfflineData: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'sensordata',
  timestamps: false,
});

module.exports = SensorData;
