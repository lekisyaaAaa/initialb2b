const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Dedicated administrator accounts rely on email-based authentication.
const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'admins',
  timestamps: true,
  underscored: true,
});

module.exports = Admin;