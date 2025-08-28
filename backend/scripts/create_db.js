const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  let connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5075/postgres';
  // ensure we connect to the default 'postgres' database for creation
  try {
    const url = new URL(connectionString);
    url.pathname = '/postgres';
    connectionString = url.toString();
  } catch (e) {
    // fallback: leave connectionString as-is
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='beantobin'");
    if (res.rows.length === 0) {
      console.log('Creating database beantobin...');
      await client.query('CREATE DATABASE beantobin');
      console.log('Database created.');
    } else {
      console.log('Database beantobin already exists.');
    }
  } catch (err) {
    console.error('Failed to create database:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
