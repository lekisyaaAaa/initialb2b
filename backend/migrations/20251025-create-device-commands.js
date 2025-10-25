"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.createTable('device_commands', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'devices',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      command_type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      requested_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      dispatched_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      response_payload: {
        type: DataTypes.JSON,
        allowNull: true
      },
      response_received_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });
    await queryInterface.addIndex('device_commands', ['device_id']);
    await queryInterface.addIndex('device_commands', ['status']);
  },
  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeIndex('device_commands', ['status']);
    await queryInterface.removeIndex('device_commands', ['device_id']);
    await queryInterface.dropTable('device_commands');
  }
};
