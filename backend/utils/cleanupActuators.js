const sequelize = require('../services/database_pg');
const Actuator = require('../models/Actuator');

(async () => {
  try {
    await sequelize.authenticate();

    const removed = await Actuator.destroy({ where: { name: 'Ventilation Fan' } });

    if (removed > 0) {
      console.log(`Removed ${removed} Ventilation Fan actuator record(s).`);
    } else {
      console.log('No Ventilation Fan actuator records found.');
    }
  } catch (error) {
    console.error('Failed to remove Ventilation Fan actuator:', error.message || error);
    process.exitCode = 1;
    return;
  }

  try {
    await sequelize.close();
  } catch (closeError) {
    console.warn('Warning: failed to close sequelize connection:', closeError.message || closeError);
  }
})();
