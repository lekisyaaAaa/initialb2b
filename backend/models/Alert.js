const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Alert = sequelize.define('Alert', {
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'alerts',
  timestamps: false,
});

module.exports = Alert;
