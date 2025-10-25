const express = require('express');
const { body, query, validationResult } = require('express-validator');
const SensorData = require('../models/SensorData');
const Alert = require('../models/Alert');
const Settings = require('../models/Settings');
const Device = require('../models/Device');
const deviceManager = require('../services/deviceManager');
const { auth, optionalAuth } = require('../middleware/auth');
const {
  toPlainObject,
  ensureIsoString,
  sanitizeSensorPayload,
  sanitizeAlertPayload,
  buildSensorSummary,
} = require('../utils/sensorFormatting');

const DEVICE_STATUS_TIMEOUT_MS = Math.max(
  2000,
  parseInt(process.env.DEVICE_OFFLINE_TIMEOUT_MS || process.env.SENSOR_STALE_THRESHOLD_MS || '60000', 10)
);

const STALE_SENSOR_MAX_AGE_MS = Math.max(
  2000,
  parseInt(process.env.SENSOR_STALE_THRESHOLD_MS || process.env.DEVICE_OFFLINE_TIMEOUT_MS || '60000', 10)
);

const router = express.Router();

// Broadcast data to connected clients (native WebSocket + Socket.IO)
const broadcastSensorData = (data) => {
  const payload = sanitizeSensorPayload(data, data && data.alerts ? data.alerts : []);
  const summary = buildSensorSummary(payload);
  payload.sensorSummary = summary;
  payload.isStale = false;
  payload.receivedAt = ensureIsoString(new Date());

  if (global.wsConnections && global.wsConnections.size > 0) {
    const message = JSON.stringify({
      type: 'sensor_data',
      data: payload
    });

    global.wsConnections.forEach((ws) => {
      if (ws.readyState === 1) {
        try {
          ws.send(message);
          if (Array.isArray(summary) && summary.length > 0) {
            ws.send(JSON.stringify({
              type: 'device_sensor_summary',
              deviceId: payload.deviceId || null,
              sensors: summary,
              timestamp: payload.timestamp,
            }));
          }
        } catch (error) {
          console.error('WebSocket send error:', error);
          global.wsConnections.delete(ws);
        }
      }
    });
  }

  if (global.io && typeof global.io.emit === 'function') {
    try {
      global.io.emit('sensor_update', payload);
      // Support legacy clients listening on old event name.
      global.io.emit('newSensorData', payload);
      if (Array.isArray(summary) && summary.length > 0) {
        global.io.emit('device_sensor_update', {
          deviceId: payload.deviceId || null,
          sensors: summary,
          timestamp: payload.timestamp,
          isStale: false,
        });
      }
    } catch (error) {
      console.warn('Socket.IO emit failed for sensor_update:', error && error.message ? error.message : error);
    }
  }

  return payload;
};

// Helper function to check thresholds and create alerts
const checkThresholds = async (sensorData) => {
  try {
    const plainSensor = toPlainObject(sensorData) || {};

    // Guard: do not generate alerts for offline/imported/simulated data.
    if (plainSensor.isOfflineData) {
      return [];
    }

    // Guard: ensure the reading timestamp is recent (avoid triggering alerts
    // from stale readings). Skip alerts for data older than 15 minutes.
    try {
      const rawTimestamp = plainSensor.timestamp || (sensorData && sensorData.timestamp);
      const ts = rawTimestamp ? (rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp)) : null;
      if (ts && (Date.now() - ts.getTime() > 15 * 60 * 1000)) {
        return [];
      }
    } catch (error) {
      // Ignore timestamp parsing issues and continue.
    }

    const settings = await Settings.getSettings();
    const thresholds = (settings && settings.thresholds) || {};
    const sanitizedSensor = sanitizeSensorPayload(plainSensor, []);

    const alertsToCreate = [];
    const pushAlert = ({ type, severity, message, threshold }) => {
      const sensorSnapshot = JSON.parse(JSON.stringify(sanitizedSensor));
      alertsToCreate.push({
        type,
        severity,
        message,
        threshold: threshold || null,
        deviceId: sanitizedSensor.deviceId || null,
        sensorData: sensorSnapshot,
        createdAt: new Date(),
        status: 'new',
      });
    };

    const temperatureThresholds = thresholds.temperature || {};
    if (typeof plainSensor.temperature === 'number') {
      const { warning, critical } = temperatureThresholds;
      if (typeof critical === 'number' && plainSensor.temperature > critical) {
        pushAlert({
          type: 'temperature',
          severity: 'critical',
          message: `Critical temperature: ${plainSensor.temperature}°C (threshold: ${critical}°C)`,
          threshold: { value: critical, operator: '>' },
        });
      } else if (typeof warning === 'number' && plainSensor.temperature > warning) {
        pushAlert({
          type: 'temperature',
          severity: 'high',
          message: `High temperature: ${plainSensor.temperature}°C (threshold: ${warning}°C)`,
          threshold: { value: warning, operator: '>' },
        });
      }
    }

    const humidityThresholds = thresholds.humidity || {};
    if (typeof plainSensor.humidity === 'number') {
      const { warning, critical } = humidityThresholds;
      if (typeof critical === 'number' && plainSensor.humidity > critical) {
        pushAlert({
          type: 'humidity',
          severity: 'critical',
          message: `Critical humidity: ${plainSensor.humidity}% (threshold: ${critical}%)`,
          threshold: { value: critical, operator: '>' },
        });
      } else if (typeof warning === 'number' && plainSensor.humidity > warning) {
        pushAlert({
          type: 'humidity',
          severity: 'high',
          message: `High humidity: ${plainSensor.humidity}% (threshold: ${warning}%)`,
          threshold: { value: warning, operator: '>' },
        });
      }
    }

    const moistureThresholds = thresholds.moisture || {};
    if (typeof plainSensor.moisture === 'number') {
      const { warning, critical } = moistureThresholds;
      if (typeof critical === 'number' && plainSensor.moisture < critical) {
        pushAlert({
          type: 'moisture',
          severity: 'critical',
          message: `Critical low moisture: ${plainSensor.moisture}% (threshold: ${critical}%)`,
          threshold: { value: critical, operator: '<' },
        });
      } else if (typeof warning === 'number' && plainSensor.moisture < warning) {
        pushAlert({
          type: 'moisture',
          severity: 'medium',
          message: `Low moisture: ${plainSensor.moisture}% (threshold: ${warning}%)`,
          threshold: { value: warning, operator: '<' },
        });
      }
    }

    const phThresholds = thresholds.ph || {};
    if (typeof plainSensor.ph === 'number') {
      const { minCritical, maxCritical, minWarning, maxWarning } = phThresholds;
      if ((typeof minCritical === 'number' && plainSensor.ph < minCritical) ||
          (typeof maxCritical === 'number' && plainSensor.ph > maxCritical)) {
        pushAlert({
          type: 'ph',
          severity: 'critical',
          message: `Critical pH level: ${plainSensor.ph} (threshold: ${minCritical}-${maxCritical})`,
          threshold: { value: [minCritical, maxCritical], operator: 'outside' },
        });
      } else if ((typeof minWarning === 'number' && plainSensor.ph < minWarning) ||
                 (typeof maxWarning === 'number' && plainSensor.ph > maxWarning)) {
        pushAlert({
          type: 'ph',
          severity: 'high',
          message: `Warning pH level: ${plainSensor.ph} (threshold: ${minWarning}-${maxWarning})`,
          threshold: { value: [minWarning, maxWarning], operator: 'outside' },
        });
      }
    }

    const ecThresholds = thresholds.ec || {};
    if (typeof plainSensor.ec === 'number') {
      const { warning, critical } = ecThresholds;
      if (typeof critical === 'number' && plainSensor.ec > critical) {
        pushAlert({
          type: 'ec',
          severity: 'critical',
          message: `Critical EC level: ${plainSensor.ec} mS/cm (threshold: ${critical} mS/cm)`,
          threshold: { value: critical, operator: '>' },
        });
      } else if (typeof warning === 'number' && plainSensor.ec > warning) {
        pushAlert({
          type: 'ec',
          severity: 'high',
          message: `High EC level: ${plainSensor.ec} mS/cm (threshold: ${warning} mS/cm)`,
          threshold: { value: warning, operator: '>' },
        });
      }
    }

    const nitrogenThresholds = thresholds.nitrogen || {};
    if (typeof plainSensor.nitrogen === 'number') {
      const { minWarning, minCritical } = nitrogenThresholds;
      if (typeof minCritical === 'number' && plainSensor.nitrogen < minCritical) {
        pushAlert({
          type: 'nitrogen',
          severity: 'critical',
          message: `Critical low nitrogen: ${plainSensor.nitrogen} mg/kg (threshold: ${minCritical} mg/kg)`,
          threshold: { value: minCritical, operator: '<' },
        });
      } else if (typeof minWarning === 'number' && plainSensor.nitrogen < minWarning) {
        pushAlert({
          type: 'nitrogen',
          severity: 'medium',
          message: `Low nitrogen: ${plainSensor.nitrogen} mg/kg (threshold: ${minWarning} mg/kg)`,
          threshold: { value: minWarning, operator: '<' },
        });
      }
    }

    const phosphorusThresholds = thresholds.phosphorus || {};
    if (typeof plainSensor.phosphorus === 'number') {
      const { minWarning, minCritical } = phosphorusThresholds;
      if (typeof minCritical === 'number' && plainSensor.phosphorus < minCritical) {
        pushAlert({
          type: 'phosphorus',
          severity: 'critical',
          message: `Critical low phosphorus: ${plainSensor.phosphorus} mg/kg (threshold: ${minCritical} mg/kg)`,
          threshold: { value: minCritical, operator: '<' },
        });
      } else if (typeof minWarning === 'number' && plainSensor.phosphorus < minWarning) {
        pushAlert({
          type: 'phosphorus',
          severity: 'medium',
          message: `Low phosphorus: ${plainSensor.phosphorus} mg/kg (threshold: ${minWarning} mg/kg)`,
          threshold: { value: minWarning, operator: '<' },
        });
      }
    }

    const potassiumThresholds = thresholds.potassium || {};
    if (typeof plainSensor.potassium === 'number') {
      const { minWarning, minCritical } = potassiumThresholds;
      if (typeof minCritical === 'number' && plainSensor.potassium < minCritical) {
        pushAlert({
          type: 'potassium',
          severity: 'critical',
          message: `Critical low potassium: ${plainSensor.potassium} mg/kg (threshold: ${minCritical} mg/kg)`,
          threshold: { value: minCritical, operator: '<' },
        });
      } else if (typeof minWarning === 'number' && plainSensor.potassium < minWarning) {
        pushAlert({
          type: 'potassium',
          severity: 'medium',
          message: `Low potassium: ${plainSensor.potassium} mg/kg (threshold: ${minWarning} mg/kg)`,
          threshold: { value: minWarning, operator: '<' },
        });
      }
    }

    const waterLevelThresholds = thresholds.waterLevel || {};
    if (plainSensor.waterLevel !== undefined) {
      const { critical } = waterLevelThresholds;
      if (critical !== undefined && plainSensor.waterLevel === critical) {
        pushAlert({
          type: 'water_level',
          severity: 'critical',
          message: 'Critical water level: No water detected',
          threshold: { value: critical, operator: '==' },
        });
      }
    }

    const batteryThresholds = thresholds.batteryLevel || {};
    if (typeof plainSensor.batteryLevel === 'number') {
      const { warning, critical } = batteryThresholds;
      if (typeof critical === 'number' && plainSensor.batteryLevel < critical) {
        pushAlert({
          type: 'battery_low',
          severity: 'critical',
          message: `Critical battery level: ${plainSensor.batteryLevel}% (threshold: ${critical}%)`,
          threshold: { value: critical, operator: '<' },
        });
      } else if (typeof warning === 'number' && plainSensor.batteryLevel < warning) {
        pushAlert({
          type: 'battery_low',
          severity: 'medium',
          message: `Low battery level: ${plainSensor.batteryLevel}% (threshold: ${warning}%)`,
          threshold: { value: warning, operator: '<' },
        });
      }
    }

    if (alertsToCreate.length === 0) {
      return [];
    }

    const persistedAlerts = [];
    for (const alertData of alertsToCreate) {
      const created = await Alert.createAlert(alertData);
      const createdPlain = toPlainObject(created) || {};
      persistedAlerts.push(
        sanitizeAlertPayload({
          ...alertData,
          ...createdPlain,
          sensorData: alertData.sensorData,
        })
      );
    }

    return persistedAlerts;
  } catch (error) {
    console.error('Error checking thresholds:', error);
    return [];
  }
};

// @route   POST /api/sensors
// @desc    Submit sensor data (from ESP32)
// @access  Public (ESP32 doesn't authenticate)
router.post('/', [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('temperature').optional().isNumeric().withMessage('Temperature must be a number'),
  body('humidity').optional().isNumeric().withMessage('Humidity must be a number'),
  body('moisture').optional().isNumeric().withMessage('Moisture must be a number'),
  body('ph').optional().isNumeric().withMessage('pH must be a number'),
  body('ec').optional().isNumeric().withMessage('EC must be a number'),
  body('nitrogen').optional().isNumeric().withMessage('Nitrogen must be a number'),
  body('phosphorus').optional().isNumeric().withMessage('Phosphorus must be a number'),
  body('potassium').optional().isNumeric().withMessage('Potassium must be a number'),
  body('waterLevel').optional().isInt().withMessage('Water level must be an integer'),
  body('timestamp').optional().isISO8601().withMessage('Invalid timestamp format')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      deviceId,
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

    // Validate device registration and online status before accepting live sensor data
    let device = await Device.findOne({ where: { deviceId } });
    if (!device || device.status !== 'online') {
      try {
        // Auto-register devices that skipped the heartbeat flow so readings are not discarded.
        device = await deviceManager.markDeviceOnline(deviceId, {
          autoRegisteredAt: new Date().toISOString(),
          source: 'sensor_post_auto_register'
        });
      } catch (error) {
        console.warn('Failed to auto-register device from sensor data:', error && error.message ? error.message : error);
      }

      if (!device || device.status !== 'online') {
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

    // Create sensor data (Sequelize-compatible)
  const sensorData = await SensorData.create({
      deviceId,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
      humidity: humidity !== undefined ? parseFloat(humidity) : undefined,
      moisture: moisture !== undefined ? parseFloat(moisture) : undefined,
      ph: ph !== undefined ? parseFloat(ph) : undefined,
      ec: ec !== undefined ? parseFloat(ec) : undefined,
      nitrogen: nitrogen !== undefined ? parseFloat(nitrogen) : undefined,
      phosphorus: phosphorus !== undefined ? parseFloat(phosphorus) : undefined,
      potassium: potassium !== undefined ? parseFloat(potassium) : undefined,
      waterLevel: waterLevel !== undefined ? parseInt(waterLevel) : undefined,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      batteryLevel: batteryLevel !== undefined ? parseFloat(batteryLevel) : undefined,
      signalStrength: signalStrength !== undefined ? parseFloat(signalStrength) : undefined,
      isOfflineData
    });

    // Respond quickly — process alerts and broadcast asynchronously to avoid blocking or failing the request
  const plain = sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData);

  // Fire-and-forget alerts and broadcast (only for live data). We still mark the device online via deviceManager
  const metadataUpdate = Object.assign(
    {},
    device && typeof device.metadata === 'object' ? device.metadata : {},
    { lastSeen: new Date().toISOString() }
  );
  await deviceManager.markDeviceOnline(deviceId, metadataUpdate);

  // Fire-and-forget alerts and broadcast
    (async () => {
      try {
        const alerts = await checkThresholds(sensorData);
        try {
          broadcastSensorData({ ...plain, alerts: alerts.length > 0 ? alerts : undefined });
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

    for (const item of data) {
      const sensorData = await SensorData.create({
        deviceId,
        temperature: parseFloat(item.temperature),
        humidity: parseFloat(item.humidity),
        moisture: parseFloat(item.moisture),
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        batteryLevel: item.batteryLevel ? parseFloat(item.batteryLevel) : undefined,
        signalStrength: item.signalStrength ? parseFloat(item.signalStrength) : undefined,
        isOfflineData: true
      });

      const alerts = await checkThresholds(sensorData);
      totalAlerts += alerts.length;
      
      savedData.push(sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : sensorData);
    }

    // Broadcast latest data to WebSocket clients
    if (savedData.length > 0) {
      const latestData = savedData[savedData.length - 1];
      broadcastSensorData(latestData.toObject());
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
// @desc    Get latest sensor readings
// @access  Public/Private
router.get('/latest', optionalAuth, async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    let query = {};
    if (deviceId) {
      query.deviceId = deviceId;
    }

    // Support both Sequelize and Mongoose-style models. Prefer Sequelize when available.
    let latestData = null;
    try {
      if (SensorData && SensorData.sequelize && typeof SensorData.findOne === 'function') {
        // Build Sequelize where clause
        const { Op } = SensorData.sequelize;
        const where = {};
        if (deviceId) where.deviceId = deviceId;
        latestData = await SensorData.findOne({ where, order: [['timestamp', 'DESC']] });
        if (latestData && typeof latestData.get === 'function') latestData = latestData.get({ plain: true });
      } else {
        // If model isn't Sequelize, return empty data for stability
        latestData = null;
      }
    } catch (e) {
      console.warn('Error querying latest sensor data:', e && e.message ? e.message : e);
      latestData = null;
    }

    const now = Date.now();

    if (!latestData) {
      return res.json({ success: true, data: null, systemStatus: 'online', databaseStatus: 'connected', status: 'offline' });
    }

    const candidateDeviceId = deviceId || latestData.deviceId;
    let deviceRecord = null;

    if (candidateDeviceId && Device && typeof Device.findOne === 'function') {
      try {
        deviceRecord = await Device.findOne({ where: { deviceId: candidateDeviceId } });
      } catch (deviceErr) {
        console.warn('Failed to load device while resolving latest sensor data:', deviceErr && deviceErr.message ? deviceErr.message : deviceErr);
      }
    }

    const timestampMs = latestData.timestamp ? new Date(latestData.timestamp).getTime() : NaN;
    const timestampFresh = Number.isFinite(timestampMs) && (now - timestampMs) <= STALE_SENSOR_MAX_AGE_MS;

    let deviceFresh = false;
    if (deviceRecord) {
      const heartbeatMs = deviceRecord.lastHeartbeat ? new Date(deviceRecord.lastHeartbeat).getTime() : NaN;
      const heartbeatFresh = Number.isFinite(heartbeatMs) && (now - heartbeatMs) <= DEVICE_STATUS_TIMEOUT_MS;
      deviceFresh = deviceRecord.status === 'online' && heartbeatFresh;
      latestData.deviceStatus = deviceRecord.status;
      latestData.deviceLastHeartbeat = deviceRecord.lastHeartbeat || null;
    }

    const sanitizedLatest = sanitizeSensorPayload(latestData, latestData.alerts || []);
    sanitizedLatest.deviceId = sanitizedLatest.deviceId || candidateDeviceId || null;
    sanitizedLatest.deviceStatus = deviceRecord ? deviceRecord.status : (deviceFresh ? 'online' : 'offline');
    sanitizedLatest.deviceLastHeartbeat = deviceRecord && deviceRecord.lastHeartbeat ? ensureIsoString(deviceRecord.lastHeartbeat) : null;
    sanitizedLatest.deviceOnline = deviceFresh;
    sanitizedLatest.isStale = !timestampFresh;
    sanitizedLatest.sampleAgeMs = Number.isFinite(timestampMs) ? now - timestampMs : null;
    sanitizedLatest.sensorSummary = buildSensorSummary(sanitizedLatest);
    sanitizedLatest.lastSeen = sanitizedLatest.timestamp;

    res.json({
      success: true,
      status: sanitizedLatest.deviceOnline ? 'online' : 'offline',
      systemStatus: sanitizedLatest.deviceOnline ? 'online' : (sanitizedLatest.isStale ? 'stale' : 'offline'),
      databaseStatus: 'connected',
      data: sanitizedLatest,
    });

  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor data'
    });
  }
});

// @route   GET /api/sensors/history
// @desc    Get historical sensor data
// @access  Private
router.get('/history', auth, [
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('deviceId').optional().notEmpty().withMessage('Device ID cannot be empty'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format')
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

    const {
      limit = 100,
      page = 1,
      deviceId,
      startDate,
      endDate
    } = req.query;

    // Build query
    // Build Sequelize-friendly where clause
    const { Op } = SensorData.sequelize || {};
    let query = {};
    if (deviceId) query.deviceId = deviceId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp[Op.gte] = new Date(startDate);
      if (endDate) query.timestamp[Op.lte] = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get data with pagination
    // Support Sequelize and Mongoose
    let data = [];
    let total = 0;
    try {
      if (SensorData && SensorData.sequelize && typeof SensorData.findAll === 'function') {
        data = await SensorData.findAll({ where: query, order: [['timestamp', 'DESC']], offset: skip, limit: parseInt(limit), raw: true });
        total = await SensorData.count({ where: query });
      } else {
        // Non-Sequelize fallback: return empty result for stability
        data = [];
        total = 0;
      }
    } catch (e) {
      console.warn('Error fetching sensor history:', e && e.message ? e.message : e);
      data = [];
      total = 0;
    }

    res.json({
      success: true,
      data: {
        sensorData: data,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor history'
    });
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
