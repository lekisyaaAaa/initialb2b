const express = require('express');
const router = express.Router();
const mqttIngest = require('../services/mqttIngest');
const logger = require('../utils/logger');

// POST /api/rs485/telemetry
// Accepts JSON payloads from RS485 bridge devices as a fallback
// Security: if process.env.RS485_SECRET is set, require header 'x-rs485-secret' to match it
router.post('/telemetry', async (req, res) => {
  try {
    const secret = process.env.RS485_SECRET;
    if (secret) {
      const provided = req.header('x-rs485-secret') || req.query.secret || null;
      if (!provided || provided !== secret) {
        logger.warn('RS485 telemetry rejected: bad or missing secret');
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }

    const payload = req.body || {};
    const deviceId = payload.deviceId || payload.device_id || payload.id || 'rs485-unknown';
    const topic = `rs485/${deviceId}`;

    // Pass through to the same handler used by MQTT ingest for consistent behavior
    await mqttIngest.handleMessage(topic, Buffer.from(JSON.stringify(payload)));

    return res.status(201).json({ success: true, message: 'Telemetry accepted' });
  } catch (error) {
    logger.warn('RS485 telemetry handler error', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Failed to process telemetry' });
  }
});

module.exports = router;
