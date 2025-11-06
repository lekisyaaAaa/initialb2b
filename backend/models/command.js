const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Command = sequelize.define('Command', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'device_id',
  },
  actuator: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  action: {
    type: DataTypes.ENUM('on', 'off'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'dispatched', 'done', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  responseMessage: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'response_message',
  },
}, {
  tableName: 'commands',
  underscored: true,
  timestamps: true,
});

module.exports = Command;
