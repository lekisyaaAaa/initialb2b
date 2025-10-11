const path = require('path');
const fs = require('fs');
const sequelize = require('../services/database_pg');

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
  console.log('Found migrations:', files);
  for (const file of files) {
    const migration = require(path.join(migrationsDir, file));
    if (migration && typeof migration.up === 'function') {
      console.log('Applying', file);
      try {
        await migration.up(sequelize);
        console.log('Applied', file);
      } catch (e) {
        console.error('Failed to apply', file, e && e.message ? e.message : e);
      }
    }
  }
  // close connection
  try { await sequelize.close(); } catch (e) {}
  console.log('Migrations complete');
}

if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(1); });
}
