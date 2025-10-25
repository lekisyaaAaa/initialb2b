const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');
const Device = require('./Device');

const DevicePort = sequelize.define('DevicePort', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  port_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  port_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  baud_rate: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  configured_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  configured_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'device_ports',
  timestamps: true,
  underscored: true
});

DevicePort.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

module.exports = DevicePort;
