const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Stores short-lived one-time passwords for admin login verification.
const AdminOTP = sequelize.define('AdminOTP', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'admin_id',
  },
  otpHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'otp_hash',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  consumed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  consumedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'consumed_at',
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'admin_otps',
  timestamps: true,
  underscored: true,
});

module.exports = AdminOTP;
