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
    
    // Check temperature
    if (sensorData.temperature > thresholds.temperature.critical) {
      alerts.push({
        type: 'temperature',
        severity: 'critical',
        message: `Critical temperature: ${sensorData.temperature}°C (threshold: ${thresholds.temperature.critical}°C)`,
        deviceId: sensorData.deviceId,
        sensorData: sensorData.toObject(),
        threshold: { value: thresholds.temperature.critical, operator: '>' }
      });
    } else if (sensorData.temperature > thresholds.temperature.warning) {
      alerts.push({
        type: 'temperature',
        severity: 'high',
        message: `High temperature: ${sensorData.temperature}°C (threshold: ${thresholds.temperature.warning}°C)`,
        deviceId: sensorData.deviceId,
        sensorData: sensorData.toObject(),
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
        sensorData: sensorData.toObject(),
        threshold: { value: thresholds.humidity.critical, operator: '>' }
      });
    } else if (sensorData.humidity > thresholds.humidity.warning) {
      alerts.push({
        type: 'humidity',
        severity: 'high',
        message: `High humidity: ${sensorData.humidity}% (threshold: ${thresholds.humidity.warning}%)`,
        deviceId: sensorData.deviceId,
        sensorData: sensorData.toObject(),
        threshold: { value: thresholds.humidity.warning, operator: '>' }
      });
    }
    
    // Check moisture (low moisture is bad)
    if (sensorData.moisture < thresholds.moisture.critical) {
      alerts.push({
        type: 'moisture',
        severity: 'critical',
        message: `Critical low moisture: ${sensorData.moisture}% (threshold: ${thresholds.moisture.critical}%)`,
        deviceId: sensorData.deviceId,
        sensorData: sensorData.toObject(),
        threshold: { value: thresholds.moisture.critical, operator: '<' }
      });
    } else if (sensorData.moisture < thresholds.moisture.warning) {
      alerts.push({
        type: 'moisture',
        severity: 'medium',
        message: `Low moisture: ${sensorData.moisture}% (threshold: ${thresholds.moisture.warning}%)`,
        deviceId: sensorData.deviceId,
        sensorData: sensorData.toObject(),
        threshold: { value: thresholds.moisture.warning, operator: '<' }
      });
    }
    
    // Check battery level if provided
    if (sensorData.batteryLevel !== undefined) {
      if (sensorData.batteryLevel < thresholds.batteryLevel.critical) {
        alerts.push({
          type: 'battery_low',
          severity: 'critical',
          message: `Critical battery level: ${sensorData.batteryLevel}% (threshold: ${thresholds.batteryLevel.critical}%)`,
          deviceId: sensorData.deviceId,
          sensorData: sensorData.toObject(),
          threshold: { value: thresholds.batteryLevel.critical, operator: '<' }
        });
      } else if (sensorData.batteryLevel < thresholds.batteryLevel.warning) {
        alerts.push({
          type: 'battery_low',
          severity: 'medium',
          message: `Low battery level: ${sensorData.batteryLevel}% (threshold: ${thresholds.batteryLevel.warning}%)`,
          deviceId: sensorData.deviceId,
          sensorData: sensorData.toObject(),
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

    // Create sensor data
    const sensorData = new SensorData({
      deviceId,
      temperature: parseFloat(temperature),
      humidity: parseFloat(humidity),
      moisture: parseFloat(moisture),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      batteryLevel: batteryLevel ? parseFloat(batteryLevel) : undefined,
      signalStrength: signalStrength ? parseFloat(signalStrength) : undefined,
      isOfflineData
    });

    await sensorData.save();

    // Check thresholds and create alerts
    const alerts = await checkThresholds(sensorData);

    // Broadcast to WebSocket clients
    broadcastSensorData({
      ...sensorData.toObject(),
      alerts: alerts.length > 0 ? alerts : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Sensor data received successfully',
      data: {
        sensorData,
        alertsCreated: alerts.length
      }
    });

  } catch (error) {
    console.error('Error saving sensor data:', error);
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
      const sensorData = new SensorData({
        deviceId,
        temperature: parseFloat(item.temperature),
        humidity: parseFloat(item.humidity),
        moisture: parseFloat(item.moisture),
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        batteryLevel: item.batteryLevel ? parseFloat(item.batteryLevel) : undefined,
        signalStrength: item.signalStrength ? parseFloat(item.signalStrength) : undefined,
        isOfflineData: true
      });

      await sensorData.save();
      const alerts = await checkThresholds(sensorData);
      totalAlerts += alerts.length;
      
      savedData.push(sensorData);
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

    const latestData = await SensorData.findOne(query)
      .sort({ timestamp: -1 })
      .lean();

    if (!latestData) {
      return res.status(404).json({
        success: false,
        message: 'No sensor data found'
      });
    }

    res.json({
      success: true,
      data: latestData
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
    let query = {};
    
    if (deviceId) {
      query.deviceId = deviceId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get data with pagination
    const [data, total] = await Promise.all([
      SensorData.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      SensorData.countDocuments(query)
    ]);

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

    const stats = await SensorData.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          avgTemperature: { $avg: '$temperature' },
          maxTemperature: { $max: '$temperature' },
          minTemperature: { $min: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          maxHumidity: { $max: '$humidity' },
          minHumidity: { $min: '$humidity' },
          avgMoisture: { $avg: '$moisture' },
          maxMoisture: { $max: '$moisture' },
          minMoisture: { $min: '$moisture' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        stats: stats[0] || {},
        period: `${hours} hours`,
        deviceId: deviceId || 'all'
      }
    });

  } catch (error) {
    console.error('Error fetching sensor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sensor statistics'
    });
  }
});

module.exports = router;
