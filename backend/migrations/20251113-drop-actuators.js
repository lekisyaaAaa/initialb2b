"use strict";

const { DataTypes } = require('sequelize');

async function tableExists(queryInterface, tableName) {
  try {
    const tables = await queryInterface.showAllTables();
    const normalized = (tables || []).map((table) => {
      if (typeof table === 'string') return table.toLowerCase();
      if (table && typeof table.tableName === 'string') return table.tableName.toLowerCase();
      return String(table || '').toLowerCase();
    });
    return normalized.includes(tableName.toLowerCase());
  } catch (error) {
    console.warn(`Unable to list tables while checking existence for ${tableName}:`, error && error.message ? error.message : error);
    return false;
  }
}

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName);
  } catch (error) {
    return null;
  }
}

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    const tablesToDrop = ['actuator_logs', 'actuator_commands', 'actuator_states', 'actuators'];
    for (const tableName of tablesToDrop) {
      try {
        if (await tableExists(queryInterface, tableName)) {
          await queryInterface.dropTable(tableName);
          console.log(`Dropped table ${tableName}`);
        }
      } catch (error) {
        console.warn(`Failed to drop table ${tableName}:`, error && error.message ? error.message : error);
        throw error;
      }
    }

    const dropColumnIfExists = async (tableName, columnName) => {
      const description = await describeTableSafe(queryInterface, tableName);
      if (description && Object.prototype.hasOwnProperty.call(description, columnName)) {
        try {
          await queryInterface.removeColumn(tableName, columnName);
          console.log(`Removed column ${columnName} from ${tableName}`);
        } catch (error) {
          console.warn(`Failed to remove column ${columnName} from ${tableName}:`, error && error.message ? error.message : error);
          throw error;
        }
      }
    };

    await dropColumnIfExists('device_commands', 'actuator');
    await dropColumnIfExists('commands', 'actuator');
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    const createTableIfMissing = async (tableName, definition, options = {}) => {
      if (!(await tableExists(queryInterface, tableName))) {
        await queryInterface.createTable(tableName, definition, options);
        console.log(`Restored table ${tableName}`);
      }
    };

    await createTableIfMissing('actuators', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      mode: {
        type: DataTypes.ENUM('manual', 'auto'),
        allowNull: false,
        defaultValue: 'auto',
      },
      lastUpdated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deviceAck: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      deviceAckMessage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    }, { timestamps: false });

    await createTableIfMissing('actuator_logs', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      deviceId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      actuatorType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      triggeredBy: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'automatic',
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    }, { timestamps: false });

    await createTableIfMissing('actuator_commands', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      command: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    }, { timestamps: false });

    await createTableIfMissing('actuator_states', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      actuator_key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      state: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      reported_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    }, { timestamps: false });

    const addColumnIfMissing = async (tableName, columnName, definition) => {
      const description = await describeTableSafe(queryInterface, tableName);
      if (description && !Object.prototype.hasOwnProperty.call(description, columnName)) {
        await queryInterface.addColumn(tableName, columnName, definition);
        console.log(`Restored column ${columnName} on ${tableName}`);
      }
    };

    await addColumnIfMissing('device_commands', 'actuator', {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await addColumnIfMissing('commands', 'actuator', {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'solenoid1',
    });
  },
};
