const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Device model to track external sensor units (ESP32 etc.)
const Device = sequelize.define('Device', {
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('online', 'offline'),
    allowNull: false,
    defaultValue: 'offline'
  },
  lastHeartbeat: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'devices',
  timestamps: false
});

module.exports = Device;
