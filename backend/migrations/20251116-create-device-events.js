'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.createTable('device_events', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      device_id: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      event_type: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      payload: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      source: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await queryInterface.addIndex('device_events', ['device_id']);
    await queryInterface.addIndex('device_events', ['timestamp']);
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeIndex('device_events', ['timestamp']);
    await queryInterface.removeIndex('device_events', ['device_id']);
    await queryInterface.dropTable('device_events');
  },
};
