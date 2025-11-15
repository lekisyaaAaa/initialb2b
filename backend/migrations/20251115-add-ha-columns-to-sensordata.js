'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const dialect = typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : 'postgres';
    const jsonType = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

    await queryInterface.addColumn('sensordata', 'source', {
      type: DataTypes.STRING(64),
      allowNull: true,
    });

    await queryInterface.addColumn('sensordata', 'raw_payload', {
      type: jsonType,
      allowNull: true,
    });

    await queryInterface.addIndex('sensordata', ['deviceId', 'timestamp'], {
      name: 'sensordata_device_timestamp_idx',
    });
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.removeIndex('sensordata', 'sensordata_device_timestamp_idx').catch(() => {});
    await queryInterface.removeColumn('sensordata', 'raw_payload').catch(() => {});
    await queryInterface.removeColumn('sensordata', 'source').catch(() => {});
  },
};
