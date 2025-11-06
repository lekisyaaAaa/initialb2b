'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.createTable('commands', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      device_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
       actuator: {
         type: DataTypes.STRING(32),
         allowNull: false,
       },
      action: {
        type: DataTypes.ENUM('on', 'off'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'dispatched', 'done', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      response_message: {
        type: DataTypes.STRING(255),
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

    await queryInterface.addIndex('commands', ['device_id']);
    await queryInterface.addIndex('commands', ['status']);
     await queryInterface.addIndex('commands', ['actuator']);
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
     await queryInterface.removeIndex('commands', ['actuator']);
    await queryInterface.removeIndex('commands', ['status']);
    await queryInterface.removeIndex('commands', ['device_id']);
    await queryInterface.dropTable('commands');
  },
};
