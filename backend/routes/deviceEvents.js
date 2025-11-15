const express = require('express');
const { query, validationResult } = require('express-validator');
const DeviceEvent = require('../models/DeviceEvent');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/device-events?deviceId=&limit=100
router.get('/', [auth, adminOnly, query('limit').optional().isInt({ min: 1, max: 2000 })], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const deviceId = req.query.deviceId ? String(req.query.deviceId).trim() : null;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 200;

  try {
    const where = {};
    if (deviceId) where.deviceId = deviceId;
    const rows = await DeviceEvent.findAll({ where, order: [['timestamp', 'DESC']], limit });
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch device events', error: err && err.message ? err.message : String(err) });
  }
});

module.exports = router;
