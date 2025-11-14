const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const SensorSnapshot = sequelize.define('SensorSnapshot', {
  deviceId: {
    type: DataTypes.STRING(120),
    allowNull: false,
    primaryKey: true,
    field: 'device_id',
  },
  temperature: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'temperature',
  },
  humidity: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'humidity',
  },
  moisture: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'moisture',
  },
  floatSensor: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'float_sensor',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'timestamp',
  },
}, {
  tableName: 'sensor_snapshots',
  timestamps: false,
});

module.exports = SensorSnapshot;
