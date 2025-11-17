const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

// Simple audit log to record security-sensitive events (OTP, auth, refresh)
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  eventType: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: 'event_type',
  },
  actor: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
});

module.exports = AuditLog;
