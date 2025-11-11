"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map(t => (typeof t === 'string' ? t.toLowerCase() : (t && t.tableName ? String(t.tableName).toLowerCase() : String(t || '').toLowerCase())));

    if (normalized.includes('settings')) {
      try {
        await queryInterface.changeColumn('settings', 'value', {
          type: DataTypes.TEXT,
          allowNull: false,
        });
        console.log('Migrated settings.value -> TEXT');
      } catch (e) {
        console.error('Failed to migrate settings.value -> TEXT', e && e.message ? e.message : e);
        throw e;
      }
    } else {
      console.log('settings table not found; skipping migration');
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map(t => (typeof t === 'string' ? t.toLowerCase() : (t && t.tableName ? String(t.tableName).toLowerCase() : String(t || '').toLowerCase())));

    if (normalized.includes('settings')) {
      try {
        await queryInterface.changeColumn('settings', 'value', {
          type: DataTypes.STRING,
          allowNull: false,
        });
        console.log('Reverted settings.value -> STRING');
      } catch (e) {
        console.error('Failed to revert settings.value -> STRING', e && e.message ? e.message : e);
        throw e;
      }
    } else {
      console.log('settings table not found; skipping revert');
    }
  },
};
