'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.createTable('sensor_snapshots', {
      device_id: {
        type: DataTypes.STRING(120),
        allowNull: false,
        primaryKey: true,
      },
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      humidity: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      moisture: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      float_sensor: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('sensor_snapshots', ['timestamp']);
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeIndex('sensor_snapshots', ['timestamp']);
    await queryInterface.dropTable('sensor_snapshots');
  },
};
