(async function(){
  try{
    const sequelize = require('../backend/services/database_pg');
    const qi = sequelize.getQueryInterface();
    const table = 'sensordata';
    const cols = [
      { name: 'deviceId', type: 'TEXT' },
      { name: 'temperature', type: 'REAL' },
      { name: 'humidity', type: 'REAL' },
      { name: 'moisture', type: 'REAL' },
      { name: 'batteryLevel', type: 'REAL' },
      { name: 'signalStrength', type: 'REAL' },
      { name: 'isOfflineData', type: 'INTEGER' }
    ];
    for (const c of cols) {
      try {
        // This will throw if column exists; catch and continue
        console.log('Adding column if missing:', c.name);
        await qi.addColumn(table, c.name, { type: sequelize.Sequelize[c.type] || sequelize.Sequelize.STRING });
      } catch (e) {
        console.log('Skip or already exists:', c.name, e && e.message ? e.message : e);
      }
    }
    console.log('Done');
    process.exit(0);
  }catch(e){
    console.error('Error in add columns', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
