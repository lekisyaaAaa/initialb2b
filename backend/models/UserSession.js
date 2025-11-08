const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Tracks authenticated admin sessions for future session management features.
const UserSession = sequelize.define('UserSession', {
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
  token: {
    type: DataTypes.STRING(1024),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'user_sessions',
  timestamps: true,
  underscored: true,
});

module.exports = UserSession;
