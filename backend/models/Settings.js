const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Settings = sequelize.define('Settings', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'settings',
  timestamps: false,
});

module.exports = Settings;
