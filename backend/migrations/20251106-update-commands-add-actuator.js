const { DataTypes } = require('sequelize');

const LEGACY_SOLENOID_MAP = new Map([
  [1, 'solenoid1'],
  [2, 'solenoid2'],
  [3, 'solenoid3'],
]);

const ACTUATOR_TO_SOLENOID = new Map([
  ['solenoid1', 1],
  ['solenoid2', 2],
  ['solenoid3', 3],
]);

function detectColumn(description, name) {
  if (!description) return false;
  return Object.prototype.hasOwnProperty.call(description, name);
}

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('commands');

    await sequelize.transaction(async (transaction) => {
      if (!detectColumn(tableDescription, 'actuator')) {
        await queryInterface.addColumn(
          'commands',
          'actuator',
          {
            type: DataTypes.STRING(32),
            allowNull: true,
          },
          { transaction }
        );
      }

      if (detectColumn(tableDescription, 'solenoid')) {
        const [rows] = await sequelize.query('SELECT id, solenoid FROM commands', { transaction });
        if (Array.isArray(rows) && rows.length > 0) {
          for (const row of rows) {
            const mapped = LEGACY_SOLENOID_MAP.get(row.solenoid) || 'solenoid1';
            await sequelize.query(
              'UPDATE commands SET actuator = :actuator WHERE id = :id',
              { transaction, replacements: { actuator: mapped, id: row.id } }
            );
          }
        }

        await queryInterface.removeIndex('commands', ['solenoid'], { transaction }).catch(() => {});
        await queryInterface.removeColumn('commands', 'solenoid', { transaction });
      }

      await sequelize.query(
        "UPDATE commands SET actuator = 'solenoid1' WHERE actuator IS NULL",
        { transaction }
      );

      await queryInterface.changeColumn(
        'commands',
        'actuator',
        {
          type: DataTypes.STRING(32),
          allowNull: false,
        },
        { transaction }
      );

      await queryInterface.addIndex('commands', ['actuator'], { transaction }).catch(() => {});
    });
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('commands');

    await sequelize.transaction(async (transaction) => {
      if (!detectColumn(tableDescription, 'solenoid')) {
        await queryInterface.addColumn(
          'commands',
          'solenoid',
          {
            type: DataTypes.INTEGER,
            allowNull: true,
          },
          { transaction }
        );
      }

      const [rows] = await sequelize.query('SELECT id, actuator FROM commands', { transaction });
      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          const normalized = String(row.actuator || '').toLowerCase();
          const mapped = ACTUATOR_TO_SOLENOID.get(normalized) || 1;
          await sequelize.query(
            'UPDATE commands SET solenoid = :solenoid WHERE id = :id',
            { transaction, replacements: { solenoid: mapped, id: row.id } }
          );
        }
      }

      await queryInterface.changeColumn(
        'commands',
        'solenoid',
        {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        { transaction }
      );

      await queryInterface.addIndex('commands', ['solenoid'], { transaction }).catch(() => {});

      await queryInterface.removeIndex('commands', ['actuator'], { transaction }).catch(() => {});
      await queryInterface.removeColumn('commands', 'actuator', { transaction });
    });
  },
};
