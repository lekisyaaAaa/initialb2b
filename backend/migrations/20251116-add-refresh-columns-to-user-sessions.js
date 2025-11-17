"use strict";
const { DataTypes, Op } = require('sequelize');

async function columnExists(queryInterface, table, column) {
  const definition = await queryInterface.describeTable(table).catch(() => ({}));
  return Boolean(definition && Object.prototype.hasOwnProperty.call(definition, column));
}

module.exports = {
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    if (!(await columnExists(queryInterface, 'user_sessions', 'refresh_token_hash'))) {
      await queryInterface.addColumn('user_sessions', 'refresh_token_hash', {
        type: DataTypes.STRING(128),
        allowNull: true,
      });
      await queryInterface.addIndex('user_sessions', {
        name: 'user_sessions_refresh_token_hash_idx',
        unique: true,
        fields: ['refresh_token_hash'],
        where: {
          refresh_token_hash: {
            [Op.ne]: null,
          },
        },
      }).catch((err) => {
        console.warn('add index user_sessions_refresh_token_hash_idx warning', err && err.message ? err.message : err);
      });
    }

    if (!(await columnExists(queryInterface, 'user_sessions', 'refresh_expires_at'))) {
      await queryInterface.addColumn('user_sessions', 'refresh_expires_at', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'user_sessions', 'revoked_at'))) {
      await queryInterface.addColumn('user_sessions', 'revoked_at', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, 'user_sessions', 'revocation_reason'))) {
      await queryInterface.addColumn('user_sessions', 'revocation_reason', {
        type: DataTypes.STRING(255),
        allowNull: true,
      });
    }
  },

  down: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.removeIndex('user_sessions', 'user_sessions_refresh_token_hash_idx').catch(() => {});
    await queryInterface.removeColumn('user_sessions', 'refresh_token_hash').catch(() => {});
    await queryInterface.removeColumn('user_sessions', 'refresh_expires_at').catch(() => {});
    await queryInterface.removeColumn('user_sessions', 'revoked_at').catch(() => {});
    await queryInterface.removeColumn('user_sessions', 'revocation_reason').catch(() => {});
  },
};
