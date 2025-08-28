// Legacy MongoDB initializer removed. Project now uses Sequelize/Postgres.
// This stub preserves the public interface so any accidental imports won't throw.
const initializeDatabase = async () => {
  // No-op: Sequelize initialization handled in services/database_pg.js
  return Promise.resolve();
};

module.exports = { initializeDatabase };
