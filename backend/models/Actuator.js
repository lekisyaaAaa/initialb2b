const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Actuator = sequelize.define('Actuator', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  mode: {
    type: DataTypes.ENUM('manual', 'auto'),
    allowNull: false,
    defaultValue: 'auto',
  },
  lastUpdated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'actuators',
  timestamps: false,
});

module.exports = Actuator;
