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

    if (!normalizedTables.includes('user_sessions')) {
      await queryInterface.createTable('user_sessions', {
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
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        token: {
          type: DataTypes.STRING(1024),
          allowNull: false,
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        metadata: {
          type: DataTypes.JSON,
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

      await queryInterface.addIndex('user_sessions', ['admin_id'], { name: 'user_sessions_admin_id_idx' });
      await queryInterface.addIndex('user_sessions', ['token'], { name: 'user_sessions_token_idx', unique: true });
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.dropTable('user_sessions');
  },
};
