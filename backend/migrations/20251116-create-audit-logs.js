/* eslint-disable no-console */
module.exports = {
  up: async (sequelize) => {
    try {
      await sequelize.getQueryInterface().createTable('audit_logs', {
        id: { type: 'SERIAL', primaryKey: true },
        event_type: { type: 'VARCHAR(128)', allowNull: false },
        actor: { type: 'VARCHAR(255)', allowNull: true },
        data: { type: 'JSONB', allowNull: true },
        created_at: { type: 'TIMESTAMP WITH TIME ZONE', allowNull: false, defaultValue: sequelize.literal('NOW()') },
        updated_at: { type: 'TIMESTAMP WITH TIME ZONE', allowNull: false, defaultValue: sequelize.literal('NOW()') },
      });
      console.log('Created table audit_logs');
    } catch (err) {
      console.warn('create-audit-logs migration skipped or failed', err && err.message ? err.message : err);
    }
  },
  down: async (sequelize) => {
    try {
      await sequelize.getQueryInterface().dropTable('audit_logs');
    } catch (err) {
      console.warn('drop audit_logs migration failed', err && err.message ? err.message : err);
    }
  },
};
