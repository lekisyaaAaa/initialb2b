#!/usr/bin/env node
// Wrapper script to force visible log markers for Render one-off job runs.
// Runs the direct seeder and prints clear START/END markers so logs are easy to find.
/* eslint-disable no-console */
console.log('========== SEED-LOG-START ==========');
(async () => {
  try {
    const { execSync } = require('child_process');
    console.log('Running VermiLinks Threshold Seeder...');
    // Run the existing direct seeder and inherit stdio so console output is forwarded.
    execSync('node backend/scripts/seed_thresholds_direct.js', { stdio: 'inherit' });
    console.log('✅ Seeder completed successfully.');
  } catch (err) {
    try {
      console.error('❌ Seeder failed:', err && err.message ? err.message : err);
      if (err && err.stack) console.error(err.stack);
    } catch (e) {
      // ignore any logging error
    }
  } finally {
    console.log('========== SEED-LOG-END ==========');
  }
})();
