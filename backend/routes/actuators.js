const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const ActuatorLog = require('../models/ActuatorLog');

// @route   POST /api/actuators/control
// @desc    Control actuators (pump/solenoid)
// @access  Admin only
router.post('/control', [
  auth,
  adminAuth,
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('actuatorType').isIn(['pump', 'solenoid']).withMessage('Actuator type must be pump or solenoid'),
  body('action').isIn(['on', 'off']).withMessage('Action must be on or off'),
  body('reason').optional().isString().withMessage('Reason must be a string')
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

    const { deviceId, actuatorType, action, reason } = req.body;
    const userId = req.user.id;

    // Log the actuator control action
    const logEntry = await ActuatorLog.create({
      deviceId,
      actuatorType,
      action,
      reason: reason || 'Manual control by admin',
      triggeredBy: 'manual',
      userId
    });

    // Here you would send the control command to the ESP32
    // For now, we'll just log it and return success
    // In a real implementation, you might use MQTT, WebSocket, or another method to communicate with ESP32

    res.json({
      success: true,
      message: `${actuatorType} turned ${action} successfully`,
      logId: logEntry.id
    });

  } catch (error) {
    console.error('Error controlling actuator:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/actuators/logs
// @desc    Get actuator control logs
// @access  Admin only
router.get('/logs', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 50, deviceId, actuatorType } = req.query;

    const offset = (page - 1) * limit;

    const whereClause = {};
    if (deviceId) whereClause.deviceId = deviceId;
    if (actuatorType) whereClause.actuatorType = actuatorType;

    const logs = await ActuatorLog.findAndCountAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      logs: logs.rows,
      pagination: {
        total: logs.count,
        page: parseInt(page),
        pages: Math.ceil(logs.count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching actuator logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
