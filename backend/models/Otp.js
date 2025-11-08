const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Basic OTP log table for auditability and troubleshooting.
const Otp = sequelize.define('Otp', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  codeHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'code_hash',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'verified_at',
  },
}, {
  tableName: 'otps',
  timestamps: true,
  underscored: true,
});

module.exports = Otp;
