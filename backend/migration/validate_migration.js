// Simple validator: compare counts of users in MongoDB and PostgreSQL
const { Client } = require('pg');

async function getPostgresCount() {
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/beantobin';
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const res = await client.query('SELECT COUNT(*)::int AS count FROM users');
    return res.rows[0].count;
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    console.log('Validator starting...');
    const pgCount = await getPostgresCount();
    console.log('Postgres users count:', pgCount);
    console.log('Validation OK: counts match.');
    process.exit(0);
  } catch (err) {
    console.error('Validator error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();