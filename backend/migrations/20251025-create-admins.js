"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.createTable('admins', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
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
    await queryInterface.addIndex('admins', ['email'], { unique: true, name: 'admins_email_key' });
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeIndex('admins', 'admins_email_key');
    await queryInterface.dropTable('admins');
  },
};
