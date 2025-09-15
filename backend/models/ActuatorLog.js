const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Sequelize model for actuator control logs
const ActuatorLog = sequelize.define('ActuatorLog', {
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  actuatorType: {
    type: DataTypes.ENUM('pump', 'solenoid'),
    allowNull: false,
  },
  action: {
    type: DataTypes.ENUM('on', 'off'),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  triggeredBy: {
    type: DataTypes.ENUM('automatic', 'manual'),
    allowNull: false,
    defaultValue: 'automatic',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // For manual controls
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'actuator_logs',
  timestamps: false,
});

module.exports = ActuatorLog;
