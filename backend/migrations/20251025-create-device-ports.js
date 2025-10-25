"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.createTable('device_ports', {
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
      port_name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      port_type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      baud_rate: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      configured_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      configured_by: {
        type: DataTypes.INTEGER,
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
    await queryInterface.addIndex('device_ports', ['device_id']);
    await queryInterface.addConstraint('device_ports', {
      fields: ['device_id', 'port_name'],
      type: 'unique',
      name: 'device_ports_device_id_port_name_unique'
    });
  },
  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeConstraint('device_ports', 'device_ports_device_id_port_name_unique');
    await queryInterface.removeIndex('device_ports', ['device_id']);
    await queryInterface.dropTable('device_ports');
  }
};
