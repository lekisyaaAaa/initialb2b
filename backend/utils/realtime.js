const logger = require('./logger');

const REALTIME_EVENTS = {
  SENSOR_UPDATE: {
    primary: 'sensor:update',
    legacy: ['sensor_update', 'newSensorData', 'telemetry:update'],
  },
  SENSOR_SUMMARY: {
    primary: 'device:sensor-summary',
    legacy: ['device_sensor_update'],
  },
  ACTUATOR_UPDATE: {
    primary: 'actuator:update',
    legacy: ['actuator_update', 'actuatorUpdate'],
  },
  ALERT_NEW: {
    primary: 'alert:new',
    legacy: ['alert:trigger'],
  },
  ALERT_CLEARED: {
    primary: 'alert:cleared',
    legacy: ['alert:trigger'],
  },
  DEVICE_STATUS: {
    primary: 'device:status',
    legacy: ['device_status', 'deviceHeartbeat'],
  },
  DEVICE_COMMAND_CREATED: {
    primary: 'device:command-created',
    legacy: ['device_command_created'],
  },
  FLOAT_LOCKOUT: {
    primary: 'float:lockout',
    legacy: ['floatLockout'],
  },
};

function getIoInstance(candidate) {
  if (!candidate && global.io && typeof global.io.emit === 'function') {
    return global.io;
  }

  if (!candidate) {
    return null;
  }

  if (typeof candidate.get === 'function') {
    const maybeIo = candidate.get('io');
    if (maybeIo && typeof maybeIo.emit === 'function') {
      return maybeIo;
    }
  }

  if (typeof candidate.emit === 'function') {
    return candidate;
  }

  if (global.io && typeof global.io.emit === 'function') {
    return global.io;
  }

  return null;
}

function emitRealtime(eventDescriptor, payload, options = {}) {
  if (!eventDescriptor) {
    return false;
  }

  const descriptor = typeof eventDescriptor === 'string'
    ? { primary: eventDescriptor, legacy: [] }
    : eventDescriptor;

  if (!descriptor.primary) {
    return false;
  }

  const io = getIoInstance(options.io);
  if (!io) {
    return false;
  }

  const skipLegacy = options.skipLegacy === true;
  const eventsToEmit = [descriptor.primary];
  if (!skipLegacy && Array.isArray(descriptor.legacy)) {
    eventsToEmit.push(...descriptor.legacy.filter(Boolean));
  }

  eventsToEmit.forEach((eventName) => {
    if (!eventName) {
      return;
    }
    try {
      io.emit(eventName, payload);
    } catch (error) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn(`Realtime emit failed for ${eventName}:`, error && error.message ? error.message : error);
      }
    }
  });

  return true;
}

module.exports = {
  REALTIME_EVENTS,
  emitRealtime,
  getIoInstance,
};
