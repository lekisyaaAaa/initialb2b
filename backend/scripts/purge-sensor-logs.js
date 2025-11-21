#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const { Op } = require('sequelize');
const SensorLog = require('../models/SensorLog');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || typeof value === 'undefined') {
    return false;
  }
  const normalized = value.toString().trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const parsePositiveNumber = (value) => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return num > 0 ? num : null;
};

const parseArgs = (argv) => {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const trimmed = token.slice(2);
    if (!trimmed) {
      continue;
    }
    if (trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      result[key] = rest.join('=');
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[trimmed] = true;
    } else {
      result[trimmed] = next;
      i += 1;
    }
  }
  return result;
};

const usage = () => {
  console.log(`\nPurge sensor logs to reclaim storage.\n\n`)
  console.log('Examples:');
  console.log('  node scripts/purge-sensor-logs.js --days 30 --dry-run');
  console.log('  node scripts/purge-sensor-logs.js --before 2024-01-01T00:00:00Z');
  console.log('  node scripts/purge-sensor-logs.js --days 7 --device my-sensor-1 --sensor temperature');
  console.log('\nFlags:');
  console.log('  --days <n>           Delete logs older than N days');
  console.log('  --before <ISO date>  Delete logs recorded before this timestamp');
  console.log('  --device <id>        Optional deviceId filter');
  console.log('  --sensor <name>      Optional sensorName filter');
  console.log('  --origin <label>     Optional origin filter');
  console.log('  --dry-run            Only report how many rows match');
  console.log('  --help               Show this message');
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    process.exit(0);
  }

  const where = {};
  if (args.device || args.deviceId || args['device-id']) {
    const deviceId = (args.device || args.deviceId || args['device-id']).toString().trim();
    if (deviceId) {
      where.deviceId = deviceId;
    }
  }
  if (args.sensor || args.sensorName) {
    const sensorName = (args.sensor || args.sensorName).toString().trim();
    if (sensorName) {
      where.sensorName = sensorName;
    }
  }
  if (args.origin) {
    const origin = args.origin.toString().trim();
    if (origin) {
      where.origin = origin;
    }
  }

  let cutoff = null;
  if (args.before || args.cutoff) {
    const attempt = new Date((args.before || args.cutoff).toString());
    if (!Number.isNaN(attempt.getTime())) {
      cutoff = attempt;
    }
  }
  if (!cutoff && (args.days || args.d)) {
    const days = parsePositiveNumber(args.days || args.d);
    if (days) {
      cutoff = new Date(Date.now() - (days * MS_PER_DAY));
    }
  }

  if (!cutoff) {
    console.error('Provide --days <n> or --before <ISO timestamp> to target a time range.');
    usage();
    process.exit(1);
  }

  where.recordedAt = { [Op.lt]: cutoff };

  const dryRun = parseBoolean(args['dry-run'] || args.dryRun || args.preview);

  try {
    await SensorLog.sequelize.authenticate();
    const matched = await SensorLog.count({ where });
    if (dryRun) {
      console.log(`[DRY RUN] ${matched} sensor log rows match. Nothing deleted.`);
      console.log(`Cutoff: ${cutoff.toISOString()}`);
      process.exit(0);
    }

    if (matched === 0) {
      console.log('No sensor log rows matched the provided filters. Nothing to delete.');
      process.exit(0);
    }

    const deleted = await SensorLog.destroy({ where });
    console.log(`Deleted ${deleted} sensor log rows older than ${cutoff.toISOString()}.`);
    if (where.deviceId) {
      console.log(`deviceId filter: ${where.deviceId}`);
    }
    if (where.sensorName) {
      console.log(`sensor filter: ${where.sensorName}`);
    }
    if (where.origin) {
      console.log(`origin filter: ${where.origin}`);
    }
    process.exit(0);
  } catch (error) {
    console.error('Failed to purge sensor logs:', error && error.message ? error.message : error);
    process.exit(1);
  }
}

main();
