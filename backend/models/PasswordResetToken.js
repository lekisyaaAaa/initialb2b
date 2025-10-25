const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Stores single-use password reset tokens for admin accounts.
const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  tokenHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'token_hash',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  used: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at',
  },
}, {
  tableName: 'password_reset_tokens',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id'],
    },
    {
      fields: ['token_hash'],
      unique: true,
    },
    {
      fields: ['expires_at'],
    },
  ],
});

module.exports = PasswordResetToken;
