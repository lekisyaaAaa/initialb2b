const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');
const Device = require('./Device');

const DeviceCommand = sequelize.define('DeviceCommand', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  command_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  requested_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  dispatched_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  response_payload: {
    type: DataTypes.JSON,
    allowNull: true
  },
  response_received_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'device_commands',
  timestamps: true,
  underscored: true
});

DeviceCommand.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

module.exports = DeviceCommand;
