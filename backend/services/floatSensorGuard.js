const SensorData = require('../models/SensorData');
const logger = require('../utils/logger');

async function getLatestFloatState(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') {
    return { value: null, timestamp: null };
  }

  const trimmed = deviceId.trim();
  if (!trimmed) {
    return { value: null, timestamp: null };
  }

  try {
    const row = await SensorData.findOne({
      where: { deviceId: trimmed },
      order: [['timestamp', 'DESC']],
    });

    if (!row) {
      return { value: null, timestamp: null };
    }

    const plain = row.get ? row.get({ plain: true }) : row;
    const rawValue = plain.floatSensor ?? plain.float_sensor ?? null;
    const value = typeof rawValue === 'number' ? rawValue : rawValue == null ? null : Number(rawValue);

    return {
      value: Number.isFinite(value) ? value : null,
      timestamp: plain.timestamp ? new Date(plain.timestamp) : null,
    };
  } catch (error) {
    logger.warn('floatSensorGuard: failed to read latest float sensor state', error && error.message ? error.message : error);
    return { value: null, timestamp: null, error };
  }
}

async function enforceFloatSafety({
  deviceId,
  desiredState,
  actuatorKey,
  actuatorName,
  source = 'unknown',
}) {
  if (!desiredState) {
    return {
      allowed: true,
      floatState: null,
    };
  }

  const normalizedId = typeof deviceId === 'string' ? deviceId.trim() : '';
  if (!normalizedId) {
    return {
      allowed: true,
      floatState: null,
      note: 'Float safety skipped (deviceId unavailable)',
    };
  }

  const { value, timestamp } = await getLatestFloatState(normalizedId);

  if (value === 0) {
    const message = 'Float sensor lockout active - actuator commands blocked while float=0';
    logger.warn('floatSensorGuard: blocking actuator command', {
      deviceId: normalizedId,
      actuatorKey,
      actuatorName,
      source,
      timestamp,
    });
    return {
      allowed: false,
      statusCode: 423,
      message,
      floatState: value,
      timestamp,
    };
  }

  return {
    allowed: true,
    floatState: value,
    timestamp,
  };
}

module.exports = {
  getLatestFloatState,
  enforceFloatSafety,
};
