"use strict";

const { DataTypes } = require('sequelize');

async function tableExists(queryInterface, tableName) {
  try {
    const tables = await queryInterface.showAllTables();
    const normalized = (tables || []).map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return String(t || '').toLowerCase();
    });
    return normalized.includes(tableName.toLowerCase());
  } catch (error) {
    console.warn(`Unable to list tables while checking existence for ${tableName}:`, error && error.message ? error.message : error);
    return false;
  }
}

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'device_commands';

    if (!(await tableExists(queryInterface, tableName))) {
      // If the table is totally missing, create a minimal table compatible with the model
      await queryInterface.createTable(tableName, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        device_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        command_type: { type: DataTypes.STRING, allowNull: false },
        payload: { type: DataTypes.JSON, allowNull: true },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
        requested_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        dispatched_at: { type: DataTypes.DATE, allowNull: true },
        response_payload: { type: DataTypes.JSON, allowNull: true },
        response_received_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      });
      try {
        await queryInterface.addIndex(tableName, ['device_id']);
      } catch (e) {
        console.warn('Failed to add index on device_commands.device_id', e && e.message ? e.message : e);
      }
      return;
    }

    // Table exists: ensure column exists
    let description = null;
    try {
      description = await queryInterface.describeTable(tableName);
    } catch (err) {
      description = null;
    }

    if (!description || !Object.prototype.hasOwnProperty.call(description, 'device_id')) {
      await queryInterface.addColumn(tableName, 'device_id', {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'devices',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      try {
        await queryInterface.addIndex(tableName, ['device_id']);
      } catch (e) {
        console.warn('Failed to add index on device_commands.device_id', e && e.message ? e.message : e);
      }
    } else {
      // Column already present
      console.log('Migration 20251116: device_commands.device_id already exists; nothing to do.');
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'device_commands';

    // Remove the column only if it exists
    try {
      const desc = await queryInterface.describeTable(tableName);
      if (desc && Object.prototype.hasOwnProperty.call(desc, 'device_id')) {
        try {
          await queryInterface.removeIndex(tableName, ['device_id']);
        } catch (e) {
          // ignore
        }
        await queryInterface.removeColumn(tableName, 'device_id');
      }
    } catch (error) {
      console.warn(`Down migration 20251116: unable to remove device_id on ${tableName}:`, error && error.message ? error.message : error);
    }
  },
};
