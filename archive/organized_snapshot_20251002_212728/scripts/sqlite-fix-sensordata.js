const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'data', 'dev.sqlite');
const db = new sqlite3.Database(dbPath);
const adds = [
  "ALTER TABLE sensordata ADD COLUMN deviceId TEXT;",
  "ALTER TABLE sensordata ADD COLUMN temperature REAL;",
  "ALTER TABLE sensordata ADD COLUMN humidity REAL;",
  "ALTER TABLE sensordata ADD COLUMN moisture REAL;",
  "ALTER TABLE sensordata ADD COLUMN batteryLevel REAL;",
  "ALTER TABLE sensordata ADD COLUMN signalStrength REAL;",
  "ALTER TABLE sensordata ADD COLUMN isOfflineData INTEGER;"
];
(async function(){
  for (const sql of adds) {
    try {
      await new Promise((res, rej) => db.run(sql, (err) => err ? rej(err) : res()));
      console.log('Applied:', sql);
    } catch (e) {
      if (e && e.message && e.message.includes('duplicate')) {
        console.log('Already exists (skipped):', sql);
      } else {
        console.warn('Could not apply (maybe already exists):', e && e.message ? e.message : e);
      }
    }
  }
  db.close();
})();
