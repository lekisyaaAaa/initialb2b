const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, adminOnly } = require('../middleware/auth');
const ActuatorLog = require('../models/ActuatorLog');
// @route   POST /api/actuators/control
// @desc    Control actuators (pump/solenoid)
// @access  Admin only
router.post('/control', [
  auth,
  adminOnly,
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

// Helper to send WS command to a device if it's connected
async function sendCommandToDevice(deviceId, payload) {
  try {
    if (!deviceId) return false;
    const ws = global.deviceSockets && global.deviceSockets.get(deviceId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  } catch (e) {
    console.error('sendCommandToDevice error:', e && e.message ? e.message : e);
    return false;
  }
}

// POST /api/actuators/pump
router.post('/pump', [auth, adminOnly, body('deviceId').notEmpty(), body('action').isIn(['on','off','auto','manual'])], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    const { deviceId, action, reason } = req.body;
    const userId = req.user && req.user.id;

    const logEntry = await ActuatorLog.create({ deviceId, actuatorType: 'pump', action, reason: reason || 'Manual pump control', triggeredBy: 'manual', userId });

    // Forward to device via WebSocket if available
    const forwarded = await sendCommandToDevice(deviceId, { type: 'actuator', actuator: 'pump', action, reason });

    res.json({ success: true, message: `pump ${action} command processed`, logId: logEntry.id, forwarded });
  } catch (error) {
    console.error('pump endpoint error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/actuators/valve
router.post('/valve', [auth, adminOnly, body('deviceId').notEmpty(), body('action').isIn(['open','close','auto'])], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    const { deviceId, action, reason } = req.body;
    const userId = req.user && req.user.id;

    const logEntry = await ActuatorLog.create({ deviceId, actuatorType: 'solenoid', action: action === 'open' ? 'on' : action === 'close' ? 'off' : action, reason: reason || 'Manual valve control', triggeredBy: 'manual', userId });

    const forwarded = await sendCommandToDevice(deviceId, { type: 'actuator', actuator: 'valve', action, reason });

    res.json({ success: true, message: `valve ${action} command processed`, logId: logEntry.id, forwarded });
  } catch (error) {
    console.error('valve endpoint error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/actuators/pump/toggle - alias used by older frontend to toggle without payload
router.post('/pump/toggle', [auth, adminOnly, body('deviceId').notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    const { deviceId, reason } = req.body;
    const userId = req.user && req.user.id;

    // Find last pump action for device and invert
    const last = await ActuatorLog.findOne({ where: { deviceId, actuatorType: 'pump' }, order: [['timestamp', 'DESC']] });
    const nextAction = (!last || last.action === 'off') ? 'on' : 'off';

    const logEntry = await ActuatorLog.create({ deviceId, actuatorType: 'pump', action: nextAction, reason: reason || 'Toggled pump', triggeredBy: 'manual', userId });

    const forwarded = await sendCommandToDevice(deviceId, { type: 'actuator', actuator: 'pump', action: nextAction, reason });

    res.json({ success: true, message: `pump toggled to ${nextAction}`, logId: logEntry.id, forwarded });
  } catch (error) {
    console.error('pump toggle endpoint error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/actuators/valve/toggle - alias used by older frontend to toggle valve
router.post('/valve/toggle', [auth, adminOnly, body('deviceId').notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    const { deviceId, reason } = req.body;
    const userId = req.user && req.user.id;

    // Find last solenoid action for device and invert
    const last = await ActuatorLog.findOne({ where: { deviceId, actuatorType: 'solenoid' }, order: [['timestamp', 'DESC']] });
    // ActuatorLog stores solenoid as 'on'/'off' so map to open/close for forwarding
    const nextAction = (!last || last.action === 'off') ? 'open' : 'close';
    const logAction = nextAction === 'open' ? 'on' : 'off';

    const logEntry = await ActuatorLog.create({ deviceId, actuatorType: 'solenoid', action: logAction, reason: reason || 'Toggled valve', triggeredBy: 'manual', userId });

    const forwarded = await sendCommandToDevice(deviceId, { type: 'actuator', actuator: 'valve', action: nextAction, reason });

    res.json({ success: true, message: `valve toggled to ${nextAction}`, logId: logEntry.id, forwarded });
  } catch (error) {
    console.error('valve toggle endpoint error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/actuators/cycle
router.post('/cycle', [auth, adminOnly, body('deviceId').notEmpty(), body('action').isIn(['start','stop'])], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    const { deviceId, action, reason } = req.body;
    const userId = req.user && req.user.id;

    const logEntry = await ActuatorLog.create({ deviceId, actuatorType: 'cycle', action, reason: reason || 'Manual cycle control', triggeredBy: 'manual', userId });

    const forwarded = await sendCommandToDevice(deviceId, { type: 'actuator', actuator: 'cycle', action, reason });

    res.json({ success: true, message: `cycle ${action} command processed`, logId: logEntry.id, forwarded });
  } catch (error) {
    console.error('cycle endpoint error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/actuators/logs
// @desc    Get actuator control logs
// @access  Admin only
router.get('/logs', [auth, adminOnly], async (req, res) => {
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
