'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    const addColumn = async (column, type) => {
      await queryInterface.addColumn('sensor_snapshots', column, type).catch(() => {});
    };

    await addColumn('ph', { type: DataTypes.FLOAT, allowNull: true });
    await addColumn('ec', { type: DataTypes.FLOAT, allowNull: true });
    await addColumn('nitrogen', { type: DataTypes.FLOAT, allowNull: true });
    await addColumn('phosphorus', { type: DataTypes.FLOAT, allowNull: true });
    await addColumn('potassium', { type: DataTypes.FLOAT, allowNull: true });
    await addColumn('water_level', { type: DataTypes.INTEGER, allowNull: true });
    await addColumn('battery_level', { type: DataTypes.FLOAT, allowNull: true });
    await addColumn('signal_strength', { type: DataTypes.FLOAT, allowNull: true });
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const dropColumn = async (column) => {
      await queryInterface.removeColumn('sensor_snapshots', column).catch(() => {});
    };

    await dropColumn('signal_strength');
    await dropColumn('battery_level');
    await dropColumn('water_level');
    await dropColumn('potassium');
    await dropColumn('phosphorus');
    await dropColumn('nitrogen');
    await dropColumn('ec');
    await dropColumn('ph');
  },
};
