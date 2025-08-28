const sequelize = require('../services/database_pg');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Sequelize: connection OK');
    process.exit(0);
  } catch (err) {
    console.error('Sequelize: connection failed:', err.message || err);
    process.exit(2);
  }
})();
