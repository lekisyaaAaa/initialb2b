const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const NodeCache = require('node-cache');
const SensorData = require('../models/SensorData');
const Device = require('../models/Device');
const SensorSnapshot = require('../models/SensorSnapshot');
const deviceManager = require('../services/deviceManager');
const { auth } = require('../middleware/auth');
const {
  toPlainObject,
  ensureIsoString,
  sanitizeSensorPayload,
} = require('../utils/sensorFormatting');
const {
  resolveIo,
  broadcastSensorData,
  checkThresholds,
} = require('../utils/sensorEvents');
const sensorLogService = require('../services/sensorLogService');

const DEVICE_STATUS_TIMEOUT_MS = Math.max(
  2000,
  parseInt(process.env.DEVICE_OFFLINE_TIMEOUT_MS || process.env.SENSOR_STALE_THRESHOLD_MS || '60000', 10)
);

const STALE_SENSOR_MAX_AGE_MS = Math.max(
  2000,
  parseInt(process.env.SENSOR_STALE_THRESHOLD_MS || process.env.DEVICE_OFFLINE_TIMEOUT_MS || '60000', 10)
);

const router = express.Router();
const sensorCache = new NodeCache({ stdTTL: 5, checkperiod: 2 });

const allowHomeAssistantBypass = (process.env.ALLOW_HOME_ASSISTANT_PUSH_WITHOUT_SOCKET || '').toString().toLowerCase() === 'true';
const homeAssistantDeviceId = (process.env.HOME_ASSISTANT_DEVICE_ID || process.env.PRIMARY_DEVICE_ID || 'vermilinks-homeassistant').trim();
const homeAssistantHistoryDays = Number.parseInt(process.env.HOME_ASSISTANT_HISTORY_DAYS || process.env.HA_HISTORY_RETENTION_DAYS || '7', 10);
const HOME_ASSISTANT_HISTORY_MS = Math.max(1, homeAssistantHistoryDays || 7) * 24 * 60 * 60 * 1000;

async function pruneDeviceHistory(deviceId) {
  if (!deviceId) {
    return;
  }
  try {
    const cutoff = new Date(Date.now() - HOME_ASSISTANT_HISTORY_MS);
    await SensorData.destroy({
      where: {
        deviceId,
        timestamp: { [Op.lt]: cutoff },
      },
    });
  } catch (error) {
    console.warn('sensorRoutes::pruneDeviceHistory failed', error && error.message ? error.message : error);
  }
}

const MAX_RAW_PAYLOAD_CHARS = Math.max(1024, parseInt(process.env.HOME_ASSISTANT_RAW_CACHE_LIMIT || '8192', 10));

function clampRawPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= MAX_RAW_PAYLOAD_CHARS) {
      return payload;
    }
    return {
      truncated: true,
      preview: serialized.slice(0, MAX_RAW_PAYLOAD_CHARS),
    };
  } catch (error) {
    return null;
  }
}

const formatLatestSnapshot = (snapshot) => {
  if (!snapshot) {
    return null;
  }
  const toNumber = (value) => (value === null || value === undefined ? null : Number(value));
  const timestamp = snapshot.timestamp || snapshot.updated_at || snapshot.created_at;
  return {
    temperature: toNumber(snapshot.temperature),
    humidity: toNumber(snapshot.humidity),
    soil_moisture: toNumber(snapshot.moisture ?? snapshot.soil_moisture),
    ph: toNumber(snapshot.ph),
    ec: toNumber(snapshot.ec),
    nitrogen: toNumber(snapshot.nitrogen),
    phosphorus: toNumber(snapshot.phosphorus),
    potassium: toNumber(snapshot.potassium),
    water_level: toNumber(snapshot.waterLevel ?? snapshot.water_level),
    float_state: snapshot.floatSensor !== undefined && snapshot.floatSensor !== null
      ? Number(snapshot.floatSensor)
      : (snapshot.float_state !== undefined && snapshot.float_state !== null ? Number(snapshot.float_state) : null),
    battery_level: toNumber(snapshot.batteryLevel ?? snapshot.battery_level),
    signal_strength: toNumber(snapshot.signalStrength ?? snapshot.signal_strength),
    updated_at: ensureIsoString(timestamp),
  };
};

const isDuplicateSnapshot = (existing, incomingTs, toleranceMs = 1000) => {
  if (!existing || !existing.timestamp || !incomingTs) {
    return false;
  }
  const existingTs = new Date(existing.timestamp).getTime();
  const incoming = new Date(incomingTs).getTime();
  if (Number.isNaN(existingTs) || Number.isNaN(incoming)) {
    return false;
  }
  return Math.abs(existingTs - incoming) <= toleranceMs;
};

// @route   POST /api/sensors/ingest-ha
// @desc    Accept dummy telemetry pushed from Home Assistant (REST)
// @access  Public (secured by network-level access)
router.post('/ingest-ha', [
  body('temperature').optional({ nullable: true }).isNumeric().withMessage('temperature must be numeric'),
  body('humidity').optional({ nullable: true }).isNumeric().withMessage('humidity must be numeric'),
  body('soil_moisture').optional({ nullable: true }).isNumeric().withMessage('soil_moisture must be numeric'),
  body('moisture').optional({ nullable: true }).isNumeric().withMessage('moisture must be numeric'),
  body('float').optional({ nullable: true }).isInt({ min: 0, max: 1 }).withMessage('float must be 0 or 1'),
  body('float_state').optional({ nullable: true }).isInt({ min: 0, max: 1 }).withMessage('float_state must be 0 or 1'),
  body('timestamp').optional({ nullable: true }).isISO8601().withMessage('timestamp must be ISO8601 string'),
  body('source').optional({ nullable: true }).isString().isLength({ min: 1, max: 120 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const {
    temperature,
    humidity,
    soil_moisture,
    moisture,
    float,
    float_state: floatStateAlternative,
    timestamp,
    source,
  } = req.body;

  const resolvedMoisture = soil_moisture !== undefined ? soil_moisture : moisture;
  const resolvedFloat = float !== undefined ? float : floatStateAlternative;

  const hasReading = [temperature, humidity, resolvedMoisture, resolvedFloat]
    .some((value) => value !== null && value !== undefined);

  if (!hasReading) {
    return res.status(400).json({ success: false, message: 'At least one metric is required' });
  }

  const effectiveTimestamp = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(effectiveTimestamp.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid timestamp' });
  }

  try {
    const existing = await SensorSnapshot.findByPk(homeAssistantDeviceId, { raw: true });
    if (isDuplicateSnapshot(existing, effectiveTimestamp)) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Duplicate snapshot ignored',
        data: formatLatestSnapshot(existing),
      });
    }

    await SensorSnapshot.upsert({
      deviceId: homeAssistantDeviceId,
      temperature: temperature !== undefined ? Number(temperature) : null,
      humidity: humidity !== undefined ? Number(humidity) : null,
      moisture: resolvedMoisture !== undefined ? Number(resolvedMoisture) : null,
      ph: req.body.ph !== undefined ? Number(req.body.ph) : null,
      ec: req.body.ec !== undefined ? Number(req.body.ec) : null,
      nitrogen: req.body.nitrogen !== undefined ? Number(req.body.nitrogen) : null,
      phosphorus: req.body.phosphorus !== undefined ? Number(req.body.phosphorus) : null,
      potassium: req.body.potassium !== undefined ? Number(req.body.potassium) : null,
      waterLevel: req.body.waterLevel !== undefined ? Number(req.body.waterLevel) : null,
      floatSensor: resolvedFloat !== undefined && resolvedFloat !== null ? Number(resolvedFloat) : null,
      batteryLevel: req.body.batteryLevel !== undefined ? Number(req.body.batteryLevel) : null,
      signalStrength: req.body.signalStrength !== undefined ? Number(req.body.signalStrength) : null,
      timestamp: effectiveTimestamp,
    });

    const io = resolveIo(req.app);

    let sensorData = null;
    const cappedPayload = clampRawPayload(req.body);
    try {
      sensorData = await SensorData.create({
        deviceId: homeAssistantDeviceId,
        temperature: temperature !== undefined ? Number(temperature) : null,
        humidity: humidity !== undefined ? Number(humidity) : null,
        moisture: resolvedMoisture !== undefined ? Number(resolvedMoisture) : null,
        floatSensor: resolvedFloat !== undefined && resolvedFloat !== null ? Number(resolvedFloat) : null,
        ph: req.body.ph !== undefined ? Number(req.body.ph) : null,
        ec: req.body.ec !== undefined ? Number(req.body.ec) : null,
        nitrogen: req.body.nitrogen !== undefined ? Number(req.body.nitrogen) : null,
        phosphorus: req.body.phosphorus !== undefined ? Number(req.body.phosphorus) : null,
        potassium: req.body.potassium !== undefined ? Number(req.body.potassium) : null,
        waterLevel: req.body.waterLevel !== undefined ? Number(req.body.waterLevel) : null,
        batteryLevel: req.body.batteryLevel !== undefined ? Number(req.body.batteryLevel) : null,
        signalStrength: req.body.signalStrength !== undefined ? Number(req.body.signalStrength) : null,
        timestamp: effectiveTimestamp,
        source: 'home_assistant_rest',
        rawPayload: cappedPayload,
      });
      pruneDeviceHistory(homeAssistantDeviceId);
    } catch (createError) {
      console.warn('SensorData persistence for HA ingest failed (continuing):', createError?.message || createError);
    }

    const plainPayload = {
      deviceId: homeAssistantDeviceId,
      temperature: temperature !== undefined ? Number(temperature) : null,
      humidity: humidity !== undefined ? Number(humidity) : null,
      moisture: resolvedMoisture !== undefined ? Number(resolvedMoisture) : null,
      floatSensor: resolvedFloat !== undefined && resolvedFloat !== null ? Number(resolvedFloat) : null,
      ph: req.body.ph !== undefined ? Number(req.body.ph) : null,
      ec: req.body.ec !== undefined ? Number(req.body.ec) : null,
      nitrogen: req.body.nitrogen !== undefined ? Number(req.body.nitrogen) : null,
      phosphorus: req.body.phosphorus !== undefined ? Number(req.body.phosphorus) : null,
      potassium: req.body.potassium !== undefined ? Number(req.body.potassium) : null,
      waterLevel: req.body.waterLevel !== undefined ? Number(req.body.waterLevel) : null,
      batteryLevel: req.body.batteryLevel !== undefined ? Number(req.body.batteryLevel) : null,
      signalStrength: req.body.signalStrength !== undefined ? Number(req.body.signalStrength) : null,
      timestamp: effectiveTimestamp,
      source: source || 'home_assistant',
    };

    if (sensorData) {
      plainPayload.id = sensorData.id;
    }

    checkThresholds(plainPayload, io).catch(() => null);
    broadcastSensorData(plainPayload, io);

    await sensorLogService.recordSensorLogs({
      deviceId: homeAssistantDeviceId,
      metrics: {
        temperature: plainPayload.temperature,
        humidity: plainPayload.humidity,
        moisture: plainPayload.moisture,
        ph: plainPayload.ph,
        ec: plainPayload.ec,
        nitrogen: plainPayload.nitrogen,
        phosphorus: plainPayload.phosphorus,
        potassium: plainPayload.potassium,
        waterLevel: plainPayload.waterLevel,
        floatSensor: plainPayload.floatSensor,
        batteryLevel: plainPayload.batteryLevel,
        signalStrength: plainPayload.signalStrength,
      },
      origin: 'home_assistant_rest',
      recordedAt: effectiveTimestamp,
      rawPayload: cappedPayload,
    });

    sensorCache.del('latest:all');
    sensorCache.del(`latest:${homeAssistantDeviceId}`);

    return res.status(201).json({
      success: true,
      data: formatLatestSnapshot({
        temperature: plainPayload.temperature,
        humidity: plainPayload.humidity,
        moisture: plainPayload.moisture,
        floatSensor: plainPayload.floatSensor,
        timestamp: plainPayload.timestamp,
      }),
    });
  } catch (error) {
    console.error('Home Assistant ingest failed:', error);
    return res.status(500).json({ success: false, message: 'Failed to ingest Home Assistant snapshot' });
  }
});

// @route   POST /api/sensors
// @desc    Submit sensor data (from ESP32)
// @access  Public (ESP32 doesn't authenticate)
router.post('/', [
  body('deviceId').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('deviceId must be a non-empty string'),
  body('device_id').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('device_id must be a non-empty string'),
  body('temperature').optional().isNumeric().withMessage('Temperature must be a number'),
  body('humidity').optional().isNumeric().withMessage('Humidity must be a number'),
  body('moisture').optional().isNumeric().withMessage('Moisture must be a number'),
  body('soil_moisture').optional().isNumeric().withMessage('soil_moisture must be a number'),
  body('ph').optional().isNumeric().withMessage('pH must be a number'),
  body('ec').optional().isNumeric().withMessage('EC must be a number'),
  body('nitrogen').optional().isNumeric().withMessage('Nitrogen must be a number'),
  body('phosphorus').optional().isNumeric().withMessage('Phosphorus must be a number'),
  body('potassium').optional().isNumeric().withMessage('Potassium must be a number'),
  body('waterLevel').optional().isInt().withMessage('Water level must be an integer'),
  body('float_sensor').optional().isInt({ min: 0, max: 1 }).withMessage('float_sensor must be 0 or 1'),
  body('timestamp').optional().isISO8601().withMessage('Invalid timestamp format')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const normalizedDeviceId = (req.body.deviceId || req.body.device_id || '').toString().trim();
    if (!normalizedDeviceId) {
      return res.status(400).json({ success: false, message: 'Device ID is required' });
    }

    // Reject simulated telemetry explicitly when flagged by device
    if (req.body.isSimulated) {
      // Non-error: ignore simulated data from clients
      return res.status(204).json({ success: false, message: 'Ignored simulated telemetry' });
    }

    const {
      temperature,
      humidity,
      moisture,
      ph,
      ec,
      nitrogen,
      phosphorus,
      potassium,
      waterLevel,
      timestamp,
      batteryLevel,
      signalStrength,
      isOfflineData = false
    } = req.body;

    const soilMoisture = req.body.soil_moisture !== undefined ? Number(req.body.soil_moisture) : moisture;
    const floatSensor = req.body.float_sensor !== undefined ? Number(req.body.float_sensor) : undefined;

    // Ensure payload contains at least one real sensor reading (production policy)
    const hasRealReading = (temperature !== undefined && temperature !== null) ||
      (humidity !== undefined && humidity !== null) ||
      (soilMoisture !== undefined && soilMoisture !== null) ||
      (typeof floatSensor === 'number');

    if (!hasRealReading) {
      // Ignore empty telemetry posts (common from test clients); return 204 No Content
      return res.status(204).json({ success: false, message: 'Ignored empty or non-sensor telemetry' });
    }

    // Validate device registration and online status before accepting live sensor data
    let device = await Device.findOne({ where: { deviceId: normalizedDeviceId } });
    if (!device || device.status !== 'online') {
      try {
        // Auto-register devices that skipped the heartbeat flow so readings are not discarded.
        device = await deviceManager.markDeviceOnline(normalizedDeviceId, {
          autoRegisteredAt: new Date().toISOString(),
          source: 'sensor_post_auto_register'
        });
      } catch (error) {
        console.warn('Failed to auto-register device from sensor data:', error && error.message ? error.message : error);
      }

      if ((!device || device.status !== 'online') && !allowHomeAssistantBypass) {
        // Reject data from unknown or offline devices if auto-registration still failed
        return res.status(403).json({ success: false, message: 'Device not registered or not online' });
      }
    }

    // Enforce recent timestamp (avoid stale readings). Accept readings no older than 5 seconds
    const ts = timestamp ? new Date(timestamp) : new Date();
    if (Math.abs(Date.now() - ts.getTime()) > 5 * 1000) {
      // If the data is older than 5s, drop it to avoid false alerts from delayed sources
      return res.status(400).json({ success: false, message: 'Stale reading - rejected' });
    }

    const io = resolveIo(req.app);

    // Create sensor data (Sequelize-compatible)
    const sensorData = await SensorData.create({
      deviceId: normalizedDeviceId,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
      humidity: humidity !== undefined ? parseFloat(humidity) : undefined,
      moisture: soilMoisture !== undefined ? parseFloat(soilMoisture) : undefined,
      ph: ph !== undefined ? parseFloat(ph) : undefined,
      ec: ec !== undefined ? parseFloat(ec) : undefined,
      nitrogen: nitrogen !== undefined ? parseFloat(nitrogen) : undefined,
      phosphorus: phosphorus !== undefined ? parseFloat(phosphorus) : undefined,
      potassium: potassium !== undefined ? parseFloat(potassium) : undefined,
      waterLevel: waterLevel !== undefined ? parseInt(waterLevel, 10) : (typeof floatSensor === 'number' ? floatSensor : undefined),
      floatSensor: typeof floatSensor === 'number' ? floatSensor : undefined,
      timestamp: ts,
      batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : undefined,
      signalStrength: signalStrength !== undefined ? parseFloat(signalStrength) : undefined,
      isOfflineData,
      source: 'esp32',
      rawPayload: null,
    });

    // Respond quickly — process alerts and broadcast asynchronously to avoid blocking or failing the request
    const plain = sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData);

    await SensorSnapshot.upsert({
      deviceId: normalizedDeviceId,
      temperature: temperature !== undefined ? parseFloat(temperature) : null,
      humidity: humidity !== undefined ? parseFloat(humidity) : null,
      moisture: soilMoisture !== undefined ? parseFloat(soilMoisture) : null,
      ph: ph !== undefined ? parseFloat(ph) : null,
      ec: ec !== undefined ? parseFloat(ec) : null,
      nitrogen: nitrogen !== undefined ? parseFloat(nitrogen) : null,
      phosphorus: phosphorus !== undefined ? parseFloat(phosphorus) : null,
      potassium: potassium !== undefined ? parseFloat(potassium) : null,
      waterLevel: waterLevel !== undefined ? parseInt(waterLevel, 10) : null,
      floatSensor: typeof floatSensor === 'number' ? floatSensor : null,
      batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : null,
      signalStrength: signalStrength !== undefined ? parseFloat(signalStrength) : null,
      timestamp: ts,
    });

    await sensorLogService.recordSensorLogs({
      deviceId: normalizedDeviceId,
      metrics: {
        temperature: temperature !== undefined ? parseFloat(temperature) : null,
        humidity: humidity !== undefined ? parseFloat(humidity) : null,
        moisture: soilMoisture !== undefined ? parseFloat(soilMoisture) : null,
        ph: ph !== undefined ? parseFloat(ph) : null,
        ec: ec !== undefined ? parseFloat(ec) : null,
        nitrogen: nitrogen !== undefined ? parseFloat(nitrogen) : null,
        phosphorus: phosphorus !== undefined ? parseFloat(phosphorus) : null,
        potassium: potassium !== undefined ? parseFloat(potassium) : null,
        waterLevel: waterLevel !== undefined ? parseInt(waterLevel, 10) : null,
        floatSensor: typeof floatSensor === 'number' ? floatSensor : null,
        batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : null,
        signalStrength: signalStrength !== undefined ? parseFloat(signalStrength) : null,
      },
      origin: 'esp32_http',
      recordedAt: ts,
      rawPayload: {
        temperature: temperature !== undefined ? parseFloat(temperature) : null,
        humidity: humidity !== undefined ? parseFloat(humidity) : null,
        moisture: soilMoisture !== undefined ? parseFloat(soilMoisture) : null,
        ph: ph !== undefined ? parseFloat(ph) : null,
        ec: ec !== undefined ? parseFloat(ec) : null,
        nitrogen: nitrogen !== undefined ? parseFloat(nitrogen) : null,
        phosphorus: phosphorus !== undefined ? parseFloat(phosphorus) : null,
        potassium: potassium !== undefined ? parseFloat(potassium) : null,
        waterLevel: waterLevel !== undefined ? parseInt(waterLevel, 10) : null,
        floatSensor: typeof floatSensor === 'number' ? floatSensor : null,
        batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : null,
        signalStrength: signalStrength !== undefined ? parseFloat(signalStrength) : null,
      },
    });

  // Fire-and-forget alerts and broadcast (only for live data). We still mark the device online via deviceManager
  const metadataUpdate = Object.assign(
    {},
    device && typeof device.metadata === 'object' ? device.metadata : {},
    { lastSeen: new Date().toISOString() }
  );
  await deviceManager.markDeviceOnline(normalizedDeviceId, metadataUpdate);

  // Fire-and-forget alerts and broadcast
    (async () => {
      try {
        const alerts = await checkThresholds(sensorData, io);
        try {
          broadcastSensorData({ ...plain, alerts: alerts.length > 0 ? alerts : undefined }, io);
        } catch (e) {
          console.warn('Broadcast failed (async):', e && e.message ? e.message : e);
        }
      } catch (e) {
        console.warn('Async alert processing failed:', e && e.message ? e.message : e);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Sensor data received successfully',
      data: {
        sensorData: plain,
        alertsCreated: 0
      }
    });

  } catch (error) {
    console.error('Error saving sensor data:', error);
    try {
      const fs = require('fs');
      const path = require('path');
      const logDir = path.join(__dirname, '..', 'logs');
      try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
      const logPath = path.join(logDir, 'sensor-post-errors.log');
      const now = new Date().toISOString();
      const dump = `--- ${now} ---\n${error && error.stack ? error.stack : JSON.stringify(error)}\n\n`;
      try { fs.appendFileSync(logPath, dump, 'utf8'); } catch (e) { console.warn('Failed to write error log:', e && e.message ? e.message : e); }
    } catch (e) {
      // ignore logging failures
    }
    res.status(500).json({
      success: false,
      message: 'Error saving sensor data'
    });
  }
});

// @route   POST /api/sensors/batch
// @desc    Submit multiple sensor data points (for offline sync)
// @access  Public
router.post('/batch', [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('data').isArray().withMessage('Data must be an array'),
  body('data.*.temperature').isNumeric().withMessage('Temperature must be a number'),
  body('data.*.humidity').isNumeric().withMessage('Humidity must be a number'),
  body('data.*.moisture').isNumeric().withMessage('Moisture must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { deviceId, data } = req.body;
    const savedData = [];
    let totalAlerts = 0;

    const io = resolveIo(req.app);

    for (const item of data) {
      const sensorData = await SensorData.create({
        deviceId,
        temperature: parseFloat(item.temperature),
        humidity: parseFloat(item.humidity),
        moisture: parseFloat(item.moisture),
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        batteryLevel: item.batteryLevel ? parseFloat(item.batteryLevel) : undefined,
        signalStrength: item.signalStrength ? parseFloat(item.signalStrength) : undefined,
        isOfflineData: true,
        source: 'esp32_batch',
        rawPayload: null,
      });

      await sensorLogService.recordSensorLogs({
        deviceId,
        metrics: {
          temperature: parseFloat(item.temperature),
          humidity: parseFloat(item.humidity),
          moisture: parseFloat(item.moisture),
          batteryLevel: item.batteryLevel ? parseFloat(item.batteryLevel) : null,
          signalStrength: item.signalStrength ? parseFloat(item.signalStrength) : null,
        },
        origin: 'esp32_batch',
        recordedAt: sensorData.timestamp || new Date(),
        rawPayload: {
          temperature: parseFloat(item.temperature),
          humidity: parseFloat(item.humidity),
          moisture: parseFloat(item.moisture),
          batteryLevel: item.batteryLevel ? parseFloat(item.batteryLevel) : null,
          signalStrength: item.signalStrength ? parseFloat(item.signalStrength) : null,
        },
      });

      const alerts = await checkThresholds(sensorData, io);
      totalAlerts += alerts.length;
      
      savedData.push(sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : sensorData);
    }

    // Broadcast latest data to WebSocket clients
    if (savedData.length > 0) {
      const latestData = savedData[savedData.length - 1];
      const latestPayload = latestData && typeof latestData.toObject === 'function'
        ? latestData.toObject()
        : latestData;
      broadcastSensorData(latestPayload, io);
    }

    res.status(201).json({
      success: true,
      message: `${savedData.length} sensor data points saved successfully`,
      data: {
        saved: savedData.length,
        alertsCreated: totalAlerts
      }
    });

  } catch (error) {
    console.error('Error saving batch sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving batch sensor data'
    });
  }
});

// @route   GET /api/sensors/latest
// @desc    Get latest sensor reading (cached 5s)
// @access  Public
router.get('/latest', async (req, res) => {
  try {
    const deviceId = (req.query.device_id || req.query.deviceId || '').toString().trim();
    const cacheKey = deviceId ? `latest:${deviceId}` : 'latest:all';
    const cached = sensorCache.get(cacheKey);
    if (cached !== undefined) {
      if (cached === null) {
        return res.status(204).send();
      }
      return res.json(cached);
    }

    let formatted = null;

    if (deviceId) {
      const snapshot = await SensorSnapshot.findByPk(deviceId, { raw: true });
      if (snapshot) {
        formatted = formatLatestSnapshot(snapshot);
      }
    } else {
      const snapshot = await SensorSnapshot.findOne({ order: [['timestamp', 'DESC']], raw: true });
      if (snapshot) {
        formatted = formatLatestSnapshot(snapshot);
      }
    }

    if (!formatted) {
      const where = {};
      if (deviceId) {
        where.deviceId = deviceId;
      }
      const latest = await SensorData.findOne({ where, order: [['timestamp', 'DESC']], raw: true });
      formatted = latest ? formatLatestSnapshot({
        temperature: latest.temperature,
        humidity: latest.humidity,
        moisture: latest.moisture,
        floatSensor: latest.floatSensor,
        timestamp: latest.timestamp,
      }) : null;
    }

    sensorCache.set(cacheKey, formatted || null);

    if (!formatted) {
      return res.status(204).send();
    }

    return res.json(formatted);
  } catch (error) {
    console.error('GET /api/sensors/latest err', error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// @route   GET /api/sensors
// @desc    Get paginated sensor readings (newest first)
// @access  Public
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('since').optional().isISO8601().withMessage('since must be ISO-8601 timestamp'),
  query('device_id').optional().isString().trim().notEmpty().withMessage('device_id must be a non-empty string'),
  query('deviceId').optional().isString().trim().notEmpty().withMessage('deviceId must be a non-empty string'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array(), error: 'validation_failed' });
    }

    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 100);
    const deviceId = (req.query.device_id || req.query.deviceId || '').toString().trim() || null;
    const since = req.query.since ? new Date(req.query.since) : null;

    const where = {};
    if (deviceId) {
      where.deviceId = deviceId;
    }
    if (!Number.isNaN(since?.getTime())) {
      where.timestamp = { [Op.gt]: since };
    }

    const rows = await SensorData.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit,
      raw: true,
    });

    return res.json({ ok: true, data: rows.map((row) => sanitizeSensorPayload(row, [])) });
  } catch (error) {
    console.error('GET /api/sensors err', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// @route   GET /api/sensors/stats
// @desc    Get sensor statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { deviceId, hours = 24 } = req.query;
    
    const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    
    let query = { timestamp: { $gte: hoursAgo } };
    if (deviceId) {
      query.deviceId = deviceId;
    }

    // Compute stats with Sequelize if available, otherwise fallback to aggregation
    try {
      if (SensorData && SensorData.sequelize && typeof SensorData.findAll === 'function') {
        const { fn, col } = SensorData.sequelize;
        const rows = await SensorData.findAll({
          where: query,
          attributes: [
            [fn('AVG', col('temperature')), 'avgTemperature'],
            [fn('MAX', col('temperature')), 'maxTemperature'],
            [fn('MIN', col('temperature')), 'minTemperature'],
            [fn('AVG', col('humidity')), 'avgHumidity'],
            [fn('MAX', col('humidity')), 'maxHumidity'],
            [fn('MIN', col('humidity')), 'minHumidity'],
            [fn('AVG', col('moisture')), 'avgMoisture'],
            [fn('MAX', col('moisture')), 'maxMoisture'],
            [fn('MIN', col('moisture')), 'minMoisture'],
            [fn('COUNT', col('*')), 'count']
          ],
          raw: true
        });
        const stats = rows && rows[0] ? rows[0] : {};
        res.json({ success: true, data: { stats, period: `${hours} hours`, deviceId: deviceId || 'all' } });
      } else {
        res.json({ success: true, data: { stats: {}, period: `${hours} hours`, deviceId: deviceId || 'all' } });
      }
    } catch (e) {
      console.error('Error fetching sensor stats:', e && e.message ? e.message : e);
      res.status(500).json({ success: false, message: 'Error fetching sensor statistics' });
    }

  } catch (error) {
    console.error('Error fetching sensor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor statistics'
    });
  }
});

// Register a new sensor (for admin management)
router.post('/register', auth, [
  body('deviceId').isString().notEmpty().withMessage('Device ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation errors', errors: errors.array() });
    }

    const { deviceId } = req.body;

    // Check if sensor already exists
    const existing = await SensorData.findOne({ where: { deviceId } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Sensor with this device ID already exists' });
    }

    // Create a placeholder sensor entry
    const newSensor = await SensorData.create({
      deviceId,
      temperature: null,
      humidity: null,
      moisture: null,
      status: 'registered'
    });

    res.json({ success: true, message: 'Sensor registered successfully', data: newSensor });
  } catch (error) {
    console.error('Error registering sensor:', error);
    res.status(500).json({ success: false, message: 'Error registering sensor' });
  }
});

module.exports = router;
