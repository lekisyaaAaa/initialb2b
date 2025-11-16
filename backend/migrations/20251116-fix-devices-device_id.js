"use strict";

const { DataTypes } = require('sequelize');

async function tableExists(queryInterface, tableName) {
  try {
    const tables = await queryInterface.showAllTables();
    const normalized = (tables || []).map((t) => (typeof t === 'string' ? t.toLowerCase() : (t && t.tableName ? t.tableName.toLowerCase() : String(t || '').toLowerCase())));
    return normalized.includes(tableName.toLowerCase());
  } catch (error) {
    return false;
  }
}

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'devices';

    if (!(await tableExists(queryInterface, tableName))) {
      // If devices table missing, skip — other migrations will create it
      console.log('Table devices missing; skipping 20251116-fix-devices-device_id');
      return;
    }

    const desc = await queryInterface.describeTable(tableName);

    // If device_id already exists, nothing to do
    if (desc && Object.prototype.hasOwnProperty.call(desc, 'device_id')) {
      console.log('device_id already present on devices; nothing to do.');
      return;
    }

    // Add nullable device_id column
    await queryInterface.addColumn(tableName, 'device_id', {
      type: DataTypes.STRING,
      allowNull: true,
    });

    // If legacy camelCase column exists, copy values
    if (desc && Object.prototype.hasOwnProperty.call(desc, 'deviceId')) {
      // Use raw SQL to copy values where device_id is null
      await queryInterface.sequelize.query(
        `UPDATE "${tableName}" SET device_id = "deviceId" WHERE device_id IS NULL AND "deviceId" IS NOT NULL;`
      );
    }

    // For any remaining null device_id rows, generate a fallback value based on id
    await queryInterface.sequelize.query(
      `UPDATE "${tableName}" SET device_id = concat('device-', id) WHERE device_id IS NULL;`
    );

    // Make column NOT NULL
    try {
      await queryInterface.sequelize.query(`ALTER TABLE "${tableName}" ALTER COLUMN device_id SET NOT NULL;`);
    } catch (e) {
      console.warn('Failed to set device_id NOT NULL (will continue):', e && e.message ? e.message : e);
    }

    // Add unique constraint/index if not present
    try {
      await queryInterface.addIndex(tableName, ['device_id'], { name: 'devices_device_id_key', unique: true });
    } catch (e) {
      console.warn('Failed to add unique index on devices.device_id (might already exist):', e && e.message ? e.message : e);
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'devices';
    try {
      const desc = await queryInterface.describeTable(tableName);
      if (desc && Object.prototype.hasOwnProperty.call(desc, 'device_id')) {
        try { await queryInterface.removeIndex(tableName, 'devices_device_id_key'); } catch (e) {}
        await queryInterface.removeColumn(tableName, 'device_id');
      }
    } catch (error) {
      console.warn('Down migration 20251116-fix-devices-device_id failed:', error && error.message ? error.message : error);
    }
  }
};
