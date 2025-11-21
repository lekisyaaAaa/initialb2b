#!/usr/bin/env node
/**
 * Quick DB fix script to add missing columns observed in production logs.
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/fix_db_columns.js
 */
const { Client } = require('pg');

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database');

    const queries = [
      `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();`,
      `ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();`,
      `ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS refresh_token_hash varchar(512);`
    ];

    for (const q of queries) {
      console.log('Executing:', q.replace(/\s+/g, ' ').trim().slice(0, 200));
      await client.query(q);
    }

    console.log('DB fix completed successfully');
  } catch (err) {
    console.error('DB fix failed:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

run();
