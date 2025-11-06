'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    const table = 'actuators';

    const addColumnSafely = async (name, definition) => {
      try {
        await queryInterface.addColumn(table, name, definition);
      } catch (error) {
        if (error && error.message && error.message.includes('duplicate column')) {
          return;
        }
        throw error;
      }
    };

    await addColumnSafely('device_ack', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    });

    await addColumnSafely('device_ack_message', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const table = 'actuators';

    await queryInterface.removeColumn(table, 'device_ack_message');
    await queryInterface.removeColumn(table, 'device_ack');
  },
};
