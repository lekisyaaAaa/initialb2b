const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Stores revoked access tokens to prevent reuse after logout or refresh.
const RevokedToken = sequelize.define('RevokedToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  tokenHash: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'token_hash',
    unique: true,
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'revoked_at',
    defaultValue: DataTypes.NOW,
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'revoked_tokens',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['token_hash'],
      unique: true,
    },
    {
      fields: ['revoked_at'],
    },
  ],
});

module.exports = RevokedToken;