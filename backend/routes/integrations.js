const express = require('express');
const { Op } = require('sequelize');

const SensorData = require('../models/SensorData');
const homeAssistantBridge = require('../services/homeAssistantBridge');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

const defaultDeviceId = (process.env.HOME_ASSISTANT_DEVICE_ID
  || process.env.PRIMARY_DEVICE_ID
  || 'vermilinks-homeassistant').trim();

const hasWebhookSecret = () => {
  const secret = (process.env.HOME_ASSISTANT_WEBHOOK_SECRET
    || process.env.HA_WEBHOOK_SECRET
    || '').trim();
  return secret.length > 0;
};

const freshnessWindowMs = Math.max(60_000, parseInt(process.env.HOME_ASSISTANT_STATUS_FRESH_MS || '300000', 10));

router.get('/home-assistant/status', auth, adminOnly, async (req, res) => {
  const deviceId = (req.query.deviceId || defaultDeviceId || '').toString().trim();
  const whereClause = deviceId ? { deviceId } : {};

  try {
    const [latestWebhook, latestFloat] = await Promise.all([
      SensorData.findOne({
        where: {
          ...whereClause,
          source: { [Op.in]: ['home_assistant', 'home_assistant_bridge'] },
        },
        order: [['timestamp', 'DESC']],
        attributes: ['timestamp', 'source', 'deviceId'],
      }),
      SensorData.findOne({
        where: {
          ...whereClause,
          source: 'home_assistant_float',
        },
        order: [['timestamp', 'DESC']],
        attributes: ['timestamp', 'floatSensor', 'deviceId'],
      }),
    ]);

    const now = Date.now();
    const webhookFresh = latestWebhook
      ? (now - new Date(latestWebhook.timestamp).getTime()) <= freshnessWindowMs
      : false;
    const floatFresh = latestFloat
      ? (now - new Date(latestFloat.timestamp).getTime()) <= freshnessWindowMs
      : false;

    const bridgeStatus = typeof homeAssistantBridge.getStatus === 'function'
      ? homeAssistantBridge.getStatus()
      : { enabled: false, started: false, connected: false };

    const healthy = Boolean(bridgeStatus.connected || webhookFresh || floatFresh);

    return res.status(200).json({
      success: true,
      data: {
        deviceId: deviceId || null,
        healthy,
        timestamp: new Date().toISOString(),
        bridge: bridgeStatus,
        webhook: {
          configured: hasWebhookSecret(),
          lastPayloadAt: latestWebhook ? latestWebhook.timestamp : null,
          lastSource: latestWebhook ? latestWebhook.source : null,
          fresh: webhookFresh,
        },
        floatEndpoint: {
          lastPayloadAt: latestFloat ? latestFloat.timestamp : null,
          floatSensor: latestFloat && typeof latestFloat.floatSensor === 'number' ? latestFloat.floatSensor : null,
          deviceId: latestFloat ? latestFloat.deviceId : (deviceId || null),
          fresh: floatFresh,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to compute Home Assistant integration status', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Unable to compute integration status' });
  }
});

module.exports = router;
