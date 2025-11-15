"use strict";

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    const exists = await (async () => {
      try {
        const tables = await queryInterface.showAllTables();
        return (tables || []).map(t => (typeof t === 'string' ? t : (t.tableName || ''))).map(s => s.toLowerCase()).includes('actuator_states');
      } catch (e) {
        return false;
      }
    })();

    if (!exists) {
      await queryInterface.createTable('actuator_states', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        actuator_key: { type: DataTypes.STRING, allowNull: false },
        state: { type: DataTypes.JSON, allowNull: true },
        reported_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    try {
      await queryInterface.dropTable('actuator_states');
    } catch (e) {
      // ignore
    }
  }
};
