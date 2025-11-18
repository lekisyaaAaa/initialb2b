const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const dialect = typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : 'postgres';
const jsonType = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

const SensorLog = sequelize.define('SensorLog', {
  id: {
    type: DataTypes.BIGINT,
    autoIncrement: true,
    primaryKey: true,
  },
  deviceId: {
    type: DataTypes.STRING(120),
    allowNull: false,
    field: 'device_id',
  },
  sensorName: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'sensor_name',
  },
  value: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING(24),
    allowNull: true,
  },
  mqttTopic: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'mqtt_topic',
  },
  origin: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: 'unknown',
  },
  recordedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'recorded_at',
  },
  rawPayload: {
    type: jsonType,
    allowNull: true,
    field: 'raw_payload',
  },
}, {
  tableName: 'sensor_logs',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SensorLog;
