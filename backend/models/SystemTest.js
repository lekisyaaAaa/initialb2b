const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const SystemTest = sequelize.define('SystemTest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  runId: {
    type: DataTypes.UUID,
    allowNull: false,
    defaultValue: DataTypes.UUIDV4,
    field: 'run_id',
  },
  section: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'pending',
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  durationMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'duration_ms',
  },
}, {
  tableName: 'system_tests',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['run_id'] },
    { fields: ['section'] },
    { fields: ['timestamp'] },
  ],
});

module.exports = SystemTest;
