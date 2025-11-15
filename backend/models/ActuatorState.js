const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const ActuatorState = sequelize.define('ActuatorState', {
  actuatorKey: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'actuator_key',
  },
  state: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  reportedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'reported_at',
  },
}, {
  tableName: 'actuator_states',
  timestamps: false,
  underscored: true,
});

module.exports = ActuatorState;
