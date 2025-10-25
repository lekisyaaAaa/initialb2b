"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.createTable('admin_otps', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      admin_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'admins',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      otp_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      consumed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      consumed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
    await queryInterface.addIndex('admin_otps', ['admin_id']);
    await queryInterface.addIndex('admin_otps', ['expires_at']);
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.dropTable('admin_otps');
  },
};
