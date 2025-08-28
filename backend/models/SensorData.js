const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const SensorData = sequelize.define('SensorData', {
  sensorId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  value: {
    type: DataTypes.FLOAT,
    allowNull: false,
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
module.exports = SensorData;
