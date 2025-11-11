const express = require('express');
const Settings = require('../models/Settings');
const router = express.Router();

// Public endpoint for devices to fetch current thresholds/config
// GET /api/config
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const thresholds = settings.thresholds || {};
    // Log the device id if present for traceability in logs (query param, header or unknown)
    const deviceId = req.query.deviceId || req.query.device || req.get('x-device-id') || req.get('device-id') || 'unknown';
    try {
      console.log(`[CONFIG FETCH] Device ${deviceId} requested config -> thresholds served`);
    } catch (logErr) {
      // ignore logging errors
    }

    // Minimal payload for devices
    return res.json({ success: true, data: { thresholds } });
  } catch (error) {
    console.error('Error fetching device config:', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Failed to load device config' });
  }
});

module.exports = router;
