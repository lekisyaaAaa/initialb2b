const Actuator = require('../models/Actuator');
const ActuatorLog = require('../models/ActuatorLog');
const SensorData = require('../models/SensorData');
const sequelize = require('./database_pg');

const DEFAULT_ACTUATORS = [
  { name: 'Water Pump', type: 'pump' },
  { name: 'Solenoid Valve', type: 'solenoid' },
  { name: 'Ventilation Fan', type: 'fan' },
];

const ACTUATOR_TYPE_BY_NAME = new Map(
  DEFAULT_ACTUATORS.map((item) => [normalizeName(item.name), item.type])
);

let schedulerHandle = null;

function normalizeName(value = '') {
  return value.trim().toLowerCase();
}

function sanitizeActuator(actuator) {
  if (!actuator) return null;
  return {
    id: actuator.id,
    name: actuator.name,
    status: Boolean(actuator.status),
    mode: actuator.mode,
    lastUpdated: actuator.lastUpdated instanceof Date
      ? actuator.lastUpdated.toISOString()
      : new Date(actuator.lastUpdated).toISOString(),
  };
}

async function ensureEnumSupport() {
  try {
    const [tables] = await sequelize.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'actuator_logs'");
    if (!Array.isArray(tables) || tables.length === 0) {
      return;
    }
    await sequelize.query('ALTER TYPE "enum_ActuatorLogs_actuatorType" ADD VALUE IF NOT EXISTS \'fan\';');
  } catch (error) {
    const message = (error && error.message) || '';
    if (!message.includes('enum label "fan" already exists')) {
      console.warn('actuatorService: unable to extend actuator log enum:', message);
    }
  }
}

async function ensureDefaultActuators() {
  await ensureEnumSupport();

  const syncOptions = (process.env.NODE_ENV || 'development') !== 'production'
    ? { alter: true }
    : {};

  await Actuator.sync(syncOptions);
  await ActuatorLog.sync(syncOptions);

  for (const definition of DEFAULT_ACTUATORS) {
    const existing = await Actuator.findOne({ where: { name: definition.name } });
    if (!existing) {
      await Actuator.create({
        name: definition.name,
        status: false,
        mode: 'auto',
      });
    }
  }

  return listActuators();
}

async function listActuators() {
  const rows = await Actuator.findAll({ order: [['id', 'ASC']] });
  return rows.map(sanitizeActuator);
}

async function findActuatorById(id) {
  return Actuator.findByPk(id);
}

function actuatorTypeFromName(name) {
  return ACTUATOR_TYPE_BY_NAME.get(normalizeName(name)) || 'pump';
}

async function logActuatorAction(actuator, action, options = {}) {
  try {
    await ActuatorLog.create({
      deviceId: options.deviceId || 'system',
      actuatorType: actuatorTypeFromName(actuator.name),
      action,
      reason: options.reason || null,
      triggeredBy: options.triggeredBy === 'manual' ? 'manual' : 'automatic',
      userId: options.triggeredBy === 'manual' ? (options.userId || null) : null,
    });
  } catch (error) {
    console.warn('actuatorService: failed to log actuator action:', error && error.message ? error.message : error);
  }
}

async function broadcastActuator(actuator) {
  try {
    if (global.io && typeof global.io.emit === 'function') {
      global.io.emit('actuatorUpdate', sanitizeActuator(actuator));
    }
  } catch (error) {
    console.warn('actuatorService: broadcast failed:', error && error.message ? error.message : error);
  }
}

async function updateActuatorStatus(actuator, status, options = {}) {
  if (!actuator) return { changed: false, actuator: null };
  const desired = Boolean(status);
  if (Boolean(actuator.status) === desired) {
    return { changed: false, actuator };
  }

  actuator.status = desired;
  actuator.lastUpdated = new Date();
  await actuator.save();

  await logActuatorAction(actuator, desired ? 'on' : 'off', options);
  await broadcastActuator(actuator);

  return { changed: true, actuator };
}

async function updateActuatorMode(actuator, mode, options = {}) {
  if (!actuator) return { changed: false, actuator: null };
  if (!['manual', 'auto'].includes(mode)) {
    throw new Error('Invalid actuator mode');
  }
  if (actuator.mode === mode) {
    return { changed: false, actuator };
  }

  actuator.mode = mode;
  actuator.lastUpdated = new Date();
  await actuator.save();

  await logActuatorAction(actuator, mode, options);
  await broadcastActuator(actuator);

  return { changed: true, actuator };
}

async function runAutomaticControl({ source = 'scheduler' } = {}) {
  const sensorSample = await SensorData.findOne({ order: [['timestamp', 'DESC']] });
  if (!sensorSample) {
    return { success: false, reason: 'no-data', changed: [] };
  }

  const actuators = await Actuator.findAll();
  const byName = new Map(actuators.map((item) => [normalizeName(item.name), item]));
  const changed = [];

  const moisture = typeof sensorSample.moisture === 'number' ? sensorSample.moisture : null;
  const temperature = typeof sensorSample.temperature === 'number' ? sensorSample.temperature : null;

  const contextBase = {
    deviceId: sensorSample.deviceId || 'system',
    reason: undefined,
    triggeredBy: 'automatic',
  };

  if (moisture !== null) {
    const pump = byName.get(normalizeName('Water Pump'));
    const valve = byName.get(normalizeName('Solenoid Valve'));

    if (pump && pump.mode === 'auto') {
      if (moisture < 50) {
        const result = await updateActuatorStatus(pump, true, {
          ...contextBase,
          reason: `Moisture ${moisture}% below 50% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
      } else if (moisture > 70) {
        const result = await updateActuatorStatus(pump, false, {
          ...contextBase,
          reason: `Moisture ${moisture}% above 70% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
      }
    }

    if (valve && valve.mode === 'auto') {
      if (moisture < 50) {
        const result = await updateActuatorStatus(valve, true, {
          ...contextBase,
          reason: `Moisture ${moisture}% below 50% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
      } else if (moisture > 70) {
        const result = await updateActuatorStatus(valve, false, {
          ...contextBase,
          reason: `Moisture ${moisture}% above 70% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
      }
    }
  }

  if (temperature !== null) {
    const fan = byName.get(normalizeName('Ventilation Fan'));
    if (fan && fan.mode === 'auto') {
      if (temperature > 35) {
        const result = await updateActuatorStatus(fan, true, {
          ...contextBase,
          reason: `Temperature ${temperature}°C above 35°C threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
      } else if (temperature < 25) {
        const result = await updateActuatorStatus(fan, false, {
          ...contextBase,
          reason: `Temperature ${temperature}°C below 25°C threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
      }
    }
  }

  return {
    success: true,
    changed,
    sampledAt: sensorSample.timestamp,
    sample: {
      deviceId: sensorSample.deviceId,
      moisture,
      temperature,
    },
  };
}

function scheduleAutomaticControl(intervalMs = 10_000) {
  if (schedulerHandle) {
    return schedulerHandle;
  }

  schedulerHandle = setInterval(() => {
    runAutomaticControl({ source: 'scheduler' }).catch((error) => {
      console.warn('actuatorService: automatic control error:', error && error.message ? error.message : error);
    });
  }, intervalMs);

  if (typeof schedulerHandle.unref === 'function') {
    schedulerHandle.unref();
  }

  return schedulerHandle;
}

module.exports = {
  ensureDefaultActuators,
  listActuators,
  findActuatorById,
  updateActuatorStatus,
  updateActuatorMode,
  runAutomaticControl,
  scheduleAutomaticControl,
  sanitizeActuator,
};
