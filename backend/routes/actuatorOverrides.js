const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminOnly } = require('../middleware/auth');
const ActuatorState = require('../models/ActuatorState');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/actuators/override
// Admin-only: set an override state for an actuator (persisted)
router.post('/override', [auth, adminOnly, body('actuatorKey').isString().notEmpty(), body('state').exists()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { actuatorKey, state } = req.body;

    const rec = await ActuatorState.create({ actuatorKey, state, reportedAt: new Date() });

    // Broadcast override to connected clients
    try {
      const io = req.app && typeof req.app.get === 'function' ? req.app.get('io') : global.io;
      if (io && typeof io.emit === 'function') io.emit('actuator:update', { actuatorKey, state, source: 'admin-override' });
    } catch (e) {
      logger.warn('Failed to emit actuator override', e && e.message ? e.message : e);
    }

    return res.status(201).json({ success: true, data: rec });
  } catch (error) {
    console.error('Actuator override error:', error);
    return res.status(500).json({ success: false, message: 'Failed to set override' });
  }
});

// GET /api/actuators/state/:key - get latest persisted state for actuator
router.get('/state/:key', [auth, adminOnly], async (req, res) => {
  try {
    const key = req.params.key;
    const rec = await ActuatorState.findOne({ where: { actuator_key: key }, order: [['reported_at', 'DESC']] });
    if (!rec) return res.status(404).json({ success: false, message: 'State not found' });
    return res.json({ success: true, data: rec });
  } catch (error) {
    console.error('Get actuator state error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve state' });
  }
});

module.exports = router;
