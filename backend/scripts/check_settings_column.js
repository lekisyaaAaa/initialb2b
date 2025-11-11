#!/usr/bin/env node
// Checks the information_schema for the `settings.value` column type
const { Client } = require('pg');

(async function main(){
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('No DATABASE_URL found in environment');
      process.exit(2);
    }

    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const q = `
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'settings' AND column_name = 'value'
    `;
    const res = await client.query(q);
    console.log('info_schema_result:', JSON.stringify(res.rows, null, 2));
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error checking settings column:', err && err.stack ? err.stack : err);
    process.exit(3);
  }
})();
