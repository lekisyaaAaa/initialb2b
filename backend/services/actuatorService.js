const { Op } = require('sequelize');
const Actuator = require('../models/Actuator');
const ActuatorLog = require('../models/ActuatorLog');
const SensorData = require('../models/SensorData');
const sequelize = require('./database_pg');
const deviceCommandQueue = require('./deviceCommandQueue');

function normalizeName(value = '') {
  return value.trim().toLowerCase();
}

const DEFAULT_ACTUATORS = [
  { key: 'pump', name: 'Water Pump', type: 'pump' },
  { key: 'solenoid1', name: 'Solenoid Valve 1', type: 'solenoid' },
  { key: 'solenoid2', name: 'Solenoid Valve 2', type: 'solenoid' },
  { key: 'solenoid3', name: 'Solenoid Valve 3', type: 'solenoid' },
];

const ALLOWED_ACTUATOR_NAMES = DEFAULT_ACTUATORS.map((item) => item.name);

const ACTUATOR_TYPE_BY_NAME = new Map(
  DEFAULT_ACTUATORS.map((item) => [normalizeName(item.name), item.type])
);

const ACTUATOR_KEY_BY_NAME = new Map(
  DEFAULT_ACTUATORS.map((item) => [normalizeName(item.name), item.key])
);

const LEGACY_ACTUATOR_ALIASES = new Map([
  ['solenoid valve', 'solenoid1'],
  ['solenoid', 'solenoid1'],
]);

function getDefinitionByKey(key) {
  return DEFAULT_ACTUATORS.find((item) => item.key === key) || null;
}

function resolveDefinitionByName(name) {
  const normalized = normalizeName(name);
  if (ACTUATOR_KEY_BY_NAME.has(normalized)) {
    return getDefinitionByKey(ACTUATOR_KEY_BY_NAME.get(normalized));
  }
  if (LEGACY_ACTUATOR_ALIASES.has(normalized)) {
    return getDefinitionByKey(LEGACY_ACTUATOR_ALIASES.get(normalized));
  }
  return null;
}

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

function sanitizeActuator(actuator) {
  if (!actuator) return null;
  const data = actuator.get ? actuator.get({ plain: true }) : actuator;
  const key = actuatorKeyFromName(data.name);
  const lastUpdated = data.lastUpdated instanceof Date
    ? data.lastUpdated.toISOString()
    : new Date(data.lastUpdated || Date.now()).toISOString();

  return {
    id: data.id,
    name: data.name,
    type: data.type || actuatorTypeFromName(data.name),
    key,
    status: Boolean(data.status),
    mode: data.mode === 'manual' ? 'manual' : 'auto',
    lastUpdated,
    deviceAck: typeof data.deviceAck === 'boolean' ? data.deviceAck : undefined,
    deviceAckMessage: data.deviceAckMessage || undefined,
  };
}

function resolveDeviceTarget(candidate) {
  const normalized = candidate && String(candidate).trim();
  if (normalized) {
    return normalized;
  }

  if (deviceCommandQueue && typeof deviceCommandQueue.getDefaultDeviceId === 'function') {
    const defaultFromQueue = deviceCommandQueue.getDefaultDeviceId();
    if (defaultFromQueue) {
      return defaultFromQueue;
    }
  }

  const envFallback = process.env.PRIMARY_DEVICE_ID || process.env.DEFAULT_DEVICE_ID;
  if (envFallback && envFallback.trim().length > 0) {
    return envFallback.trim();
  }

  return null;
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

  const currentEnv = process.env.NODE_ENV || 'development';
  const syncOptions = currentEnv === 'production'
    ? {}
    : (currentEnv === 'test' ? {} : { alter: true });

  if (typeof Actuator.sync === 'function') {
    await Actuator.sync(syncOptions);
  }

  if (typeof ActuatorLog.sync === 'function') {
    await ActuatorLog.sync(syncOptions);
  }

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

    if (currentEnv === 'test') {
      existing.status = false;
      existing.mode = 'auto';
      existing.lastUpdated = new Date();
      existing.deviceAck = true;
      existing.deviceAckMessage = null;
      await existing.save();
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

function actuatorKeyFromName(name) {
  return ACTUATOR_KEY_BY_NAME.get(normalizeName(name)) || null;
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

  if (typeof sendCommand !== 'function') {
    console.warn('[ACTUATOR → ESP32] sendCommand not available, skipping dispatch');
    return { ok: false, message: 'Controller unavailable' };
  }

  if ((process.env.NODE_ENV || 'development') === 'test') {
    return { ok: true, message: null };
  }

  const actionLabel = desired ? 'ON' : 'OFF';
  try {
    await sendCommand(actuator.name, actionLabel, { command });
    return { ok: true, message: null };
  } catch (error) {
    const message = error && error.message ? error.message : `ESP32 command failed (${command})`;
    return { ok: false, message };
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
  actuator.deviceAck = true;
  actuator.deviceAckMessage = null;
  await actuator.save();

  const hardwareId = resolveDeviceTarget(options.deviceId);
  const actuatorKey = actuatorKeyFromName(actuator.name);
  const commandContext = {
    ...options,
    ...(actuatorKey ? { actuator: actuatorKey } : {}),
  };
  let queueResult = null;
  if (hardwareId) {
    try {
      queueResult = await deviceCommandQueue.queueActuatorCommand({
        hardwareId,
        actuatorName: actuator.name,
        desiredState: desired,
        context: commandContext,
      });
    } catch (queueError) {
      console.warn('actuatorService: failed to queue actuator command:', queueError && queueError.message ? queueError.message : queueError);
    }
  }

  let dispatchResult = { ok: true, message: null };
  let usedHttpFallback = false;

  if (!queueResult || queueResult.dispatched !== true) {
    usedHttpFallback = true;
    try {
      dispatchResult = await sendToEsp32(actuator, desired);
    } catch (err) {
      dispatchResult = { ok: false, message: err && err.message ? err.message : 'Unknown ESP32 error' };
    }
  }

  if (!dispatchResult.ok) {
    console.warn(`[ACTUATOR → ESP32] ${new Date().toISOString()} Dispatch failed: ${dispatchResult.message}`);
    actuator.deviceAck = false;
    actuator.deviceAckMessage = dispatchResult.message;
    await actuator.save();

    if (queueResult && queueResult.command) {
      await deviceCommandQueue.markCommandPending(queueResult.command.id, dispatchResult.message);
    }
  } else if (queueResult && queueResult.command && usedHttpFallback) {
    await deviceCommandQueue.markCommandCompleted(queueResult.command.id, {
      transport: 'http',
      response: dispatchResult,
    });
  }

  if (!options.skipLog) {
    const logOptions = { ...options };
    delete logOptions.skipLog;
    await logActuatorAction(actuator, desired ? 'on' : 'off', {
      ...logOptions,
      reason: dispatchResult.ok ? logOptions.reason : dispatchResult.message,
    });
  }
  await broadcastActuator(actuator);

  if (!dispatchResult.ok) {
    return { changed: true, actuator, error: dispatchResult.message };
  }

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
  actuator.deviceAck = true;
  actuator.deviceAckMessage = null;
  await actuator.save();

  if (!options.skipLog) {
    const logOptions = { ...options };
    delete logOptions.skipLog;
    await logActuatorAction(actuator, mode, logOptions);
  }
  await broadcastActuator(actuator);

  return { changed: true, actuator };
}

async function markDeviceAck(actuatorName, ackOk, { message = null } = {}) {
  if (!actuatorName) {
    return null;
  }

  const canonical = resolveDefinitionByName(actuatorName);
  if (!canonical) {
    return null;
  }

  const actuator = await Actuator.findOne({ where: { name: canonical.name } });
  if (!actuator) {
    return null;
  }

  actuator.deviceAck = Boolean(ackOk);
  actuator.deviceAckMessage = ackOk ? null : (message || actuator.deviceAckMessage || null);
  actuator.lastUpdated = new Date();
  await actuator.save();
  await broadcastActuator(actuator);

  return sanitizeActuator(actuator);
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
    const valveDefs = DEFAULT_ACTUATORS.filter((item) => item.key.startsWith('solenoid'));
    const valves = valveDefs
      .map((definition) => byName.get(normalizeName(definition.name)))
      .filter(Boolean);

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

    for (const valve of valves) {
      if (valve.mode !== 'auto') {
        continue;
      }
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
  markDeviceAck,
};
