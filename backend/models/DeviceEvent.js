const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const DeviceEvent = sequelize.define('DeviceEvent', {
  deviceId: { type: DataTypes.STRING, allowNull: false },
  eventType: { type: DataTypes.STRING, allowNull: false },
  payload: { type: DataTypes.JSON, allowNull: true },
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  source: { type: DataTypes.STRING(64), allowNull: true },
}, {
  tableName: 'device_events',
  timestamps: false,
  underscored: true,
});

module.exports = DeviceEvent;
