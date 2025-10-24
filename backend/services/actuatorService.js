const { Op } = require('sequelize');
const Actuator = require('../models/Actuator');
const ActuatorLog = require('../models/ActuatorLog');
const SensorData = require('../models/SensorData');
const sequelize = require('./database_pg');

const DEFAULT_ACTUATORS = [
  { name: 'Water Pump', type: 'pump' },
  { name: 'Solenoid Valve', type: 'solenoid' },
];

const ALLOWED_ACTUATOR_NAMES = DEFAULT_ACTUATORS.map((item) => item.name);

const ACTUATOR_TYPE_BY_NAME = new Map(
  DEFAULT_ACTUATORS.map((item) => [normalizeName(item.name), item.type])
);

const ACTUATOR_COMMANDS = {
  pump: {
    on: 'PUMP_ON',
    off: 'PUMP_OFF',
  },
  solenoid: {
    on: 'VALVE_OPEN',
    off: 'VALVE_CLOSE',
  },
};

let schedulerHandle = null;

function normalizeName(value = '') {
  return value.trim().toLowerCase();
}

function sanitizeActuator(actuator) {
  if (!actuator) return null;
  const data = actuator.get ? actuator.get({ plain: true }) : actuator;
  const lastUpdated = data.lastUpdated instanceof Date
    ? data.lastUpdated.toISOString()
    : new Date(data.lastUpdated || Date.now()).toISOString();

  return {
    id: data.id,
    name: data.name,
    type: data.type || actuatorTypeFromName(data.name),
    status: Boolean(data.status),
    mode: data.mode === 'manual' ? 'manual' : 'auto',
    lastUpdated,
    deviceAck: typeof data.deviceAck === 'boolean' ? data.deviceAck : undefined,
    deviceAckMessage: data.deviceAckMessage || undefined,
  };
}

async function ensureEnumSupport() {
  const dialect = typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : null;
  if (dialect && dialect !== 'postgres') {
    return;
  }
  try {
    const [tables] = await sequelize.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'actuator_logs'");
    if (!Array.isArray(tables) || tables.length === 0) {
      return;
    }
    // Enum already supports pump/solenoid; no additional values required.
  } catch (error) {
    const message = (error && error.message) || '';
    if (message) {
      console.warn('actuatorService: enum verification warning:', message);
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
      continue;
    }
  }

  return listActuators();
}

async function listActuators() {
  const rows = await Actuator.findAll({
    where: {
      name: { [Op.in]: ALLOWED_ACTUATOR_NAMES },
    },
    order: [['id', 'ASC']],
  });
  return rows.map(sanitizeActuator);
}

async function findActuatorById(id) {
  const actuator = await Actuator.findByPk(id);
  if (!actuator) return null;
  if (!ALLOWED_ACTUATOR_NAMES.includes(actuator.name)) {
    return null;
  }
  return actuator;
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
      const payload = sanitizeActuator(actuator);
      global.io.emit('actuator_update', payload);
      // Maintain backward compatibility with legacy clients during transition.
      global.io.emit('actuatorUpdate', payload);
    }
  } catch (error) {
    console.warn('actuatorService: broadcast failed:', error && error.message ? error.message : error);
  }
}

const { sendCommand } = require('./espController');

function resolveCommand(type, desired) {
  const commands = ACTUATOR_COMMANDS[type];
  if (!commands) return null;
  return desired ? commands.on : commands.off;
}

async function sendToEsp32(actuator, desired) {
  const type = actuatorTypeFromName(actuator.name);
  const command = resolveCommand(type, desired);
  if (!command) {
    return { ok: true, message: null };
  }

  try {
    const success = await sendCommand(command);
    if (success) {
      return { ok: true, message: null };
    }
  } catch (error) {
    return {
      ok: false,
      message: error && error.message ? error.message : `ESP32 command failed (${command})`,
    };
  }

  return {
    ok: false,
    message: `ESP32 did not acknowledge ${command}`,
  };
}

async function updateActuatorStatus(actuator, status, options = {}) {
  if (!actuator) return { changed: false, actuator: null };
  const desired = Boolean(status);
  if (Boolean(actuator.status) === desired) {
    return { changed: false, actuator };
  }

  const dispatch = await sendToEsp32(actuator, desired);
  if (!dispatch.ok) {
    console.warn('actuatorService: ESP32 dispatch failed:', dispatch.message);
    actuator.setDataValue('deviceAck', false);
    actuator.setDataValue('deviceAckMessage', dispatch.message);
    await broadcastActuator(actuator);
    return { changed: false, actuator, error: dispatch.message };
  }

  actuator.status = desired;
  actuator.lastUpdated = new Date();
  actuator.setDataValue('deviceAck', true);
  actuator.setDataValue('deviceAckMessage', null);
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
  actuator.setDataValue('deviceAck', true);
  actuator.setDataValue('deviceAckMessage', null);
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

  const actuators = await Actuator.findAll({
    where: {
      name: { [Op.in]: ALLOWED_ACTUATOR_NAMES },
    },
  });
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
        if (result.error) {
          console.warn('actuatorService: pump command failed during auto-control:', result.error);
        }
      } else if (moisture > 70) {
        const result = await updateActuatorStatus(pump, false, {
          ...contextBase,
          reason: `Moisture ${moisture}% above 70% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
        if (result.error) {
          console.warn('actuatorService: pump command failed during auto-control:', result.error);
        }
      }
    }

    if (valve && valve.mode === 'auto') {
      if (moisture < 50) {
        const result = await updateActuatorStatus(valve, true, {
          ...contextBase,
          reason: `Moisture ${moisture}% below 50% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
        if (result.error) {
          console.warn('actuatorService: valve command failed during auto-control:', result.error);
        }
      } else if (moisture > 70) {
        const result = await updateActuatorStatus(valve, false, {
          ...contextBase,
          reason: `Moisture ${moisture}% above 70% threshold (${source})`,
        });
        if (result.changed) changed.push(sanitizeActuator(result.actuator));
        if (result.error) {
          console.warn('actuatorService: valve command failed during auto-control:', result.error);
        }
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
