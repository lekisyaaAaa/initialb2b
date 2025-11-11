// Simple diagnostic script for Render one-off job to print DB env vars
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

console.log('NODE_ENV=', process.env.NODE_ENV);
console.log('DATABASE_URL=', process.env.DATABASE_URL ? 'SET' : 'UNSET');
console.log('PGSSLMODE=', process.env.PGSSLMODE || '(none)');
console.log('RENDER_REGION=', process.env.RENDER_REGION || '(none)');
console.log('All environment variables available.');

process.exit(0);
