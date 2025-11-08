"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((entry) => {
      if (typeof entry === 'string') {
        return entry.toLowerCase();
      }
      if (entry && typeof entry === 'object') {
        if (entry.tableName) {
          return String(entry.tableName).toLowerCase();
        }
        if (entry.name) {
          return String(entry.name).toLowerCase();
        }
      }
      return String(entry || '').toLowerCase();
    });

    if (normalized.includes('system_tests')) {
      return;
    }

    await queryInterface.createTable('system_tests', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      run_id: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
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
      duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex('system_tests', ['run_id'], { name: 'system_tests_run_id_idx' });
    await queryInterface.addIndex('system_tests', ['section'], { name: 'system_tests_section_idx' });
    await queryInterface.addIndex('system_tests', ['timestamp'], { name: 'system_tests_timestamp_idx' });
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.dropTable('system_tests');
  },
};
