"use strict";

const { DataTypes } = require('sequelize');

async function tableExists(queryInterface, tableName) {
  try {
    const tables = await queryInterface.showAllTables();
    const normalized = (tables || []).map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return String(t || '').toLowerCase();
    });
    return normalized.includes(tableName.toLowerCase());
  } catch (err) {
    console.warn(`Unable to list tables while checking ${tableName}:`, err && err.message ? err.message : err);
    return false;
  }
}

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'actuator_logs';

    if (await tableExists(queryInterface, tableName)) {
      console.log(`Migration: ${tableName} already exists; skipping.`);
      return;
    }

    await queryInterface.createTable(tableName, {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      device_id: { type: DataTypes.STRING, allowNull: false },
      actuator_type: { type: DataTypes.STRING, allowNull: false },
      action: { type: DataTypes.STRING, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },
      triggered_by: { type: DataTypes.STRING, allowNull: false, defaultValue: 'automatic' },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    }, { timestamps: false });

    console.log(`Created table ${tableName}`);
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'actuator_logs';
    if (await tableExists(queryInterface, tableName)) {
      await queryInterface.dropTable(tableName);
      console.log(`Dropped table ${tableName}`);
    } else {
      console.log(`Migration down: ${tableName} does not exist; nothing to do.`);
    }
  }
};
