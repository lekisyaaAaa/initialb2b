"use strict";
const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((entry) => {
      if (typeof entry === 'string') {
        return entry.toLowerCase();
      }
      if (entry && typeof entry === 'object' && entry.tableName) {
        return String(entry.tableName).toLowerCase();
      }
      return String(entry || '').toLowerCase();
    });

    if (!normalizedTables.includes('otps')) {
      await queryInterface.createTable('otps', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        code_hash: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        verified_at: {
          type: DataTypes.DATE,
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

      await queryInterface.addIndex('otps', ['email'], { name: 'otps_email_idx' });
      await queryInterface.addIndex('otps', ['expires_at'], { name: 'otps_expires_idx' });
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.dropTable('otps');
  },
};
