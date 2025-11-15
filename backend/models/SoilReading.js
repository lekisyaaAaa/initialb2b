const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const SoilReading = sequelize.define('SoilReading', {
  deviceId: { type: DataTypes.STRING, allowNull: false },
  moisture: { type: DataTypes.FLOAT, allowNull: true },
  ph: { type: DataTypes.FLOAT, allowNull: true },
  ec: { type: DataTypes.FLOAT, allowNull: true },
  nitrogen: { type: DataTypes.FLOAT, allowNull: true },
  phosphorus: { type: DataTypes.FLOAT, allowNull: true },
  potassium: { type: DataTypes.FLOAT, allowNull: true },
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  source: { type: DataTypes.STRING(64), allowNull: true },
  rawPayload: { type: DataTypes.JSON, allowNull: true, field: 'raw_payload' },
}, {
  tableName: 'soil_readings',
  timestamps: false,
  underscored: true,
});

module.exports = SoilReading;
