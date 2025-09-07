const express = require('express');
const { body, query, validationResult } = require('express-validator');
const SensorData = require('../models/SensorData');
const Alert = require('../models/Alert');
const Settings = require('../models/Settings');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Broadcast data to WebSocket clients
const broadcastSensorData = (data) => {
  if (global.wsConnections && global.wsConnections.size > 0) {
    const message = JSON.stringify({
      type: 'sensor_data',
      data: data
    });
    
    global.wsConnections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(message);
        } catch (error) {
            
          console.error('WebSocket send error:', error);
          global.wsConnections.delete(ws);
        }
      }
    });
  }
};

// Helper function to check thresholds and create alerts
const checkThresholds = async (sensorData) => {
  try {
    const settings = await Settings.getSettings();
    const thresholds = settings.thresholds;
    
    const alerts = [];
    // Normalize sensorData to a plain object for consistent handling
    const plainSensor = sensorData && typeof sensorData.get === 'function'
      ? sensorData.get({ plain: true })
      : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData);
    
    // Check temperature
    if (sensorData.temperature > thresholds.temperature.critical) {
      alerts.push({
        type: 'temperature',
        severity: 'critical',
        message: `Critical temperature: ${sensorData.temperature}°C (threshold: ${thresholds.temperature.critical}°C)`,
        deviceId: sensorData.deviceId,
  sensorData: sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData),
        threshold: { value: thresholds.temperature.critical, operator: '>' }
      });
    } else if (sensorData.temperature > thresholds.temperature.warning) {
      alerts.push({
        type: 'temperature',
        severity: 'high',
        message: `High temperature: ${sensorData.temperature}°C (threshold: ${thresholds.temperature.warning}°C)`,
        deviceId: sensorData.deviceId,
  sensorData: sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData),
        threshold: { value: thresholds.temperature.warning, operator: '>' }
      });
    }
    
    // Check humidity
    if (sensorData.humidity > thresholds.humidity.critical) {
      alerts.push({
        type: 'humidity',
        severity: 'critical',
        message: `Critical humidity: ${sensorData.humidity}% (threshold: ${thresholds.humidity.critical}%)`,
        deviceId: sensorData.deviceId,
  sensorData: sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData),
        threshold: { value: thresholds.humidity.critical, operator: '>' }
      });
    } else if (sensorData.humidity > thresholds.humidity.warning) {
      alerts.push({
        type: 'humidity',
        severity: 'high',
        message: `High humidity: ${sensorData.humidity}% (threshold: ${thresholds.humidity.warning}%)`,
        deviceId: sensorData.deviceId,
  sensorData: sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData),
        threshold: { value: thresholds.humidity.warning, operator: '>' }
      });
    }
    
    // Check moisture (low moisture is bad)
  if (plainSensor.moisture < thresholds.moisture.critical) {
      alerts.push({
        type: 'moisture',
        severity: 'critical',
        message: `Critical low moisture: ${sensorData.moisture}% (threshold: ${thresholds.moisture.critical}%)`,
        deviceId: sensorData.deviceId,
    sensorData: plainSensor,
        threshold: { value: thresholds.moisture.critical, operator: '<' }
      });
    } else if (sensorData.moisture < thresholds.moisture.warning) {
      alerts.push({
        type: 'moisture',
        severity: 'medium',
        message: `Low moisture: ${sensorData.moisture}% (threshold: ${thresholds.moisture.warning}%)`,
        deviceId: sensorData.deviceId,
    sensorData: plainSensor,
        threshold: { value: thresholds.moisture.warning, operator: '<' }
      });
    }
    
    // Check battery level if provided
    if (plainSensor.batteryLevel !== undefined) {
      if (plainSensor.batteryLevel < thresholds.batteryLevel.critical) {
        alerts.push({
          type: 'battery_low',
          severity: 'critical',
          message: `Critical battery level: ${plainSensor.batteryLevel}% (threshold: ${thresholds.batteryLevel.critical}%)`,
          deviceId: plainSensor.deviceId,
          sensorData: plainSensor,
          threshold: { value: thresholds.batteryLevel.critical, operator: '<' }
        });
      } else if (sensorData.batteryLevel < thresholds.batteryLevel.warning) {
        alerts.push({
          type: 'battery_low',
          severity: 'medium',
          message: `Low battery level: ${plainSensor.batteryLevel}% (threshold: ${thresholds.batteryLevel.warning}%)`,
          deviceId: plainSensor.deviceId,
          sensorData: plainSensor,
          threshold: { value: thresholds.batteryLevel.warning, operator: '<' }
        });
      }
    }
    
    // Create alerts in database
    for (const alertData of alerts) {
      await Alert.createAlert(alertData);
    }
    
    return alerts;
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
  body('temperature').isNumeric().withMessage('Temperature must be a number'),
  body('humidity').isNumeric().withMessage('Humidity must be a number'),
  body('moisture').isNumeric().withMessage('Moisture must be a number'),
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
      timestamp,
      batteryLevel,
      signalStrength,
      isOfflineData = false
    } = req.body;

  // Create sensor data (Sequelize-compatible)
  const sensorData = await SensorData.create({
      deviceId,
      temperature: parseFloat(temperature),
      humidity: parseFloat(humidity),
      moisture: parseFloat(moisture),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      batteryLevel: batteryLevel ? parseFloat(batteryLevel) : undefined,
      signalStrength: signalStrength ? parseFloat(signalStrength) : undefined,
      isOfflineData
    });

    // Respond quickly — process alerts and broadcast asynchronously to avoid blocking or failing the request
  const plain = sensorData && typeof sensorData.get === 'function' ? sensorData.get({ plain: true }) : (sensorData && typeof sensorData.toObject === 'function' ? sensorData.toObject() : sensorData);

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

    if (!latestData) {
      // Return a graceful empty result (poller expects a successful response); use 200 with empty data
      return res.json({ success: true, data: [] });
    }

    res.json({ success: true, data: latestData });

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

module.exports = router;
