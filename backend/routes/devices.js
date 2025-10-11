const express = require('express');
const { body, validationResult } = require('express-validator');
const Device = require('../models/Device');
const { markDeviceOnline, resetOfflineTimer } = require('../services/deviceManager');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/devices/heartbeat
// Devices call this endpoint to indicate they are online and provide metadata
router.post('/heartbeat', [
  body('deviceId').notEmpty().withMessage('deviceId is required'),
  body('timestamp').optional().isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { deviceId, timestamp, metadata } = req.body;
  try {
    const md = metadata || {};
    const device = await markDeviceOnline(deviceId, md);
    // reply with acknowledged status
    return res.json({ success: true, data: { deviceId: device.deviceId, status: device.status, lastHeartbeat: device.lastHeartbeat } });
  } catch (e) {
    console.error('Heartbeat error:', e);
    return res.status(500).json({ success: false, message: 'Failed to record heartbeat' });
  }
});

// GET /api/devices - list devices (admin or optional auth)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const devices = await Device.findAll({ order: [['lastHeartbeat','DESC']] });
    res.json({ success: true, data: devices });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to list devices' });
  }
});

module.exports = router;
