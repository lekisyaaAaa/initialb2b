'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const table = 'sensordata';

    try {
      await queryInterface.addColumn(table, 'float_sensor', {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    } catch (error) {
      if (!error || !error.message || !error.message.includes('already exists')) {
        throw error;
      }
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeColumn('sensordata', 'float_sensor');
  },
};
