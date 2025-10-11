"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    // Only add the column if it doesn't already exist
    const tableDesc = await queryInterface.describeTable('alerts').catch(() => null);
    if (tableDesc && !tableDesc.status) {
      await queryInterface.addColumn('alerts', 'status', {
        type: DataTypes.ENUM('new', 'read'),
        allowNull: false,
        defaultValue: 'new'
      });
    }
  },
  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable('alerts').catch(() => null);
    if (tableDesc && tableDesc.status) {
      // SQLite does not support dropping ENUMs cleanly; drop column where supported
      try {
        await queryInterface.removeColumn('alerts', 'status');
      } catch (e) {
        // ignore for sqlite
        console.warn('Could not remove alerts.status column:', e && e.message ? e.message : e);
      }
    }
  }
};
