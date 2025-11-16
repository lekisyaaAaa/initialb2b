// idempotent migration: create alerts table if missing
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableName = 'alerts';
    const exists = await queryInterface.sequelize.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}'`);
    if (Array.isArray(exists) && exists[0] && exists[0].length > 0) {
      return;
    }

    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      type: { type: Sequelize.STRING, allowNull: false },
      severity: { type: Sequelize.STRING, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: false },
      device_id: { type: Sequelize.STRING, allowNull: true },
      sensor_data: { type: Sequelize.JSONB || Sequelize.JSON, allowNull: true },
      is_resolved: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      acknowledged_by: { type: Sequelize.STRING, allowNull: true },
      acknowledged_at: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'new' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('alerts');
  }
};
