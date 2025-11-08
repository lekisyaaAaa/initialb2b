"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    const tableDescription = await queryInterface.describeTable('admins');

    if (!tableDescription.password_hash) {
      await queryInterface.addColumn('admins', 'password_hash', {
        type: DataTypes.STRING,
        allowNull: false,
      });
    }

    if (!tableDescription.otp_hash) {
      await queryInterface.addColumn('admins', 'otp_hash', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }

    if (!tableDescription.otp_expires_at) {
      await queryInterface.addColumn('admins', 'otp_expires_at', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    const tableDescription = await queryInterface.describeTable('admins');

    if (tableDescription.otp_expires_at) {
      await queryInterface.removeColumn('admins', 'otp_expires_at');
    }

    if (tableDescription.otp_hash) {
      await queryInterface.removeColumn('admins', 'otp_hash');
    }

    // Do not drop password_hash if it exists, as earlier migrations rely on it.
  },
};
