const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const { body, query, validationResult } = require('express-validator');
const { Op } = require('sequelize');

const SensorData = require('../models/SensorData');
const SensorSnapshot = require('../models/SensorSnapshot');
const { resolveIo, broadcastSensorData, checkThresholds } = require('../utils/sensorEvents');
const { sanitizeSensorPayload } = require('../utils/sensorFormatting');
const Actuator = require('../models/Actuator');
const ActuatorLog = require('../models/ActuatorLog');
const DeviceEvent = require('../models/DeviceEvent');
const { ensureDefaultActuators, sanitizeActuator } = require('../services/actuatorService');
const deviceManager = require('../services/deviceManager');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const { REALTIME_EVENTS, emitRealtime } = require('../utils/realtime');
const sensorLogService = require('../services/sensorLogService');

const router = express.Router();

const homeAssistantDeviceId = (process.env.HOME_ASSISTANT_DEVICE_ID || process.env.PRIMARY_DEVICE_ID || 'vermilinks-homeassistant').trim();
const webhookSecret = (process.env.HOME_ASSISTANT_WEBHOOK_SECRET || process.env.HA_WEBHOOK_SECRET || '').trim();
const historyDays = Number.parseInt(process.env.HOME_ASSISTANT_HISTORY_DAYS || process.env.HA_HISTORY_RETENTION_DAYS || '7', 10);
const HISTORY_MS = Math.max(1, historyDays || 7) * 24 * 60 * 60 * 1000;
const rawPayloadLimit = Math.max(1024, Number.parseInt(process.env.HOME_ASSISTANT_RAW_CACHE_LIMIT || '8192', 10));

const dedupeCache = new NodeCache({ stdTTL: 60, checkperiod: 30, deleteOnExpire: true });
const haDebugSecret = (process.env.HA_DEBUG_SECRET || '').toString().trim();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.parseInt(process.env.HOME_ASSISTANT_WEBHOOK_RATE_LIMIT || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
});

function getRawBody(req) {
  if (req.rawBody) {
    return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
  }
  try {
    const serialized = JSON.stringify(req.body ?? {});
    return Buffer.from(serialized);
  } catch (error) {
    return Buffer.from('');
  }
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a || '', 'utf8');
  const bufB = Buffer.from(b || '', 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(req) {
  if (!webhookSecret) {
    return false;
  }
  const signatureHeader = (req.get('x-ha-signature') || '').trim();
  const authHeader = (req.get('authorization') || '').trim();
  const raw = getRawBody(req);
  const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');

  if (signatureHeader) {
    return timingSafeEqual(signatureHeader, expected);
  }
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    return timingSafeEqual(token, webhookSecret);
  }
  return false;
}

function clampPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= rawPayloadLimit) {
      return payload;
    }
    return {
      truncated: true,
      preview: serialized.slice(0, rawPayloadLimit),
    };
  } catch (error) {
    return null;
  }
}

function normalizeFloatLevel(value) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  if (typeof value === 'number') {
    if (value >= 1) return 1;
    if (value <= 0) return 0;
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['high', 'up', 'closed', 'wet', 'full', 'on', 'true', '1', 'ok', 'safe'].includes(normalized)) {
    return 1;
  }
  if (['low', 'down', 'open', 'dry', 'empty', 'off', 'false', '0', 'alert'].includes(normalized)) {
    return 0;
  }
  return null;
}

function normalizePumpState(value) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  if (typeof value === 'number') {
    if (value >= 1) return true;
    if (value <= 0) return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['on', 'true', '1', 'active', 'running', 'start'].includes(normalized)) {
    return true;
  }
  if (['off', 'false', '0', 'inactive', 'stopped', 'stop'].includes(normalized)) {
    return false;
  }
  return null;
}

function normalizePumpMode(value) {
  if (!value && value !== 0) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (['manual', 'man', 'override'].includes(normalized)) {
    return 'manual';
  }
  if (['auto', 'automatic'].includes(normalized)) {
    return 'auto';
  }
  return null;
}

function emitActuatorUpdate(actuator) {
  if (!actuator) {
    return null;
  }
  const payload = sanitizeActuator(actuator);
  emitRealtime(REALTIME_EVENTS.ACTUATOR_UPDATE, payload);
  return payload;
}

async function syncPumpFromHa({ desiredState = null, desiredMode = null, deviceId = 'home_assistant_float' }) {
  if (typeof desiredState !== 'boolean' && !desiredMode) {
    return null;
  }

  try {
    await ensureDefaultActuators();
  } catch (error) {
    logger.warn('HA float endpoint failed to ensure default actuators', error && error.message ? error.message : error);
  }

  const pump = await Actuator.findOne({ where: { name: 'Water Pump' } });
  if (!pump) {
    return null;
  }

  let changed = false;
  const pendingLogs = [];

  if (typeof desiredState === 'boolean' && pump.status !== desiredState) {
    pump.status = desiredState;
    changed = true;
    pendingLogs.push(desiredState ? 'on' : 'off');
  }

  if (desiredMode && pump.mode !== desiredMode) {
    pump.mode = desiredMode;
    changed = true;
    pendingLogs.push(desiredMode);
  }

  if (!changed) {
    return emitActuatorUpdate(pump);
  }

  pump.lastUpdated = new Date();
  pump.deviceAck = true;
  pump.deviceAckMessage = null;
  await pump.save();

  await Promise.all(pendingLogs.map((action) => ActuatorLog.create({
    deviceId,
    actuatorType: 'pump',
    action,
    reason: 'Synced from Home Assistant float endpoint',
    triggeredBy: 'automatic',
  }).catch((error) => {
    logger.warn('HA float endpoint failed to log actuator action', error && error.message ? error.message : error);
    return null;
  })));

  return emitActuatorUpdate(pump);
}

function extractMetrics(body = {}) {
  const source = body.metrics && typeof body.metrics === 'object' ? body.metrics : body;
  const coerce = (value) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  return {
    temperature: coerce(source.temperature),
    humidity: coerce(source.humidity),
    moisture: coerce(source.moisture ?? source.soil_moisture),
    ph: coerce(source.ph),
    ec: coerce(source.ec),
    nitrogen: coerce(source.nitrogen),
    phosphorus: coerce(source.phosphorus),
    potassium: coerce(source.potassium),
    waterLevel: coerce(source.waterLevel ?? source.water_level),
    floatSensor: coerce(source.floatSensor ?? source.float_state ?? source.float),
    batteryLevel: coerce(source.batteryLevel ?? source.battery_level),
    signalStrength: coerce(source.signalStrength ?? source.signal_strength ?? source.rssi),
    pumpState: typeof (source.pumpState ?? source.pump_state ?? source.pump) !== 'undefined'
      ? normalizePumpState(source.pumpState ?? source.pump_state ?? source.pump)
      : null,
    pumpRuntimeSec: coerce(source.pumpRuntimeSec ?? source.pump_runtime_sec ?? source.pumpRuntime ?? source.pump_runtime),
    pumpFlowLpm: coerce(source.pumpFlowLpm ?? source.pump_flow_lpm ?? source.flowLpm ?? source.flow_lpm ?? source.flowRate),
  };
}

function hasRealReading(metrics) {
  return Object.values(metrics).some((value) => typeof value === 'number');
}

async function pruneHistory(deviceId) {
  if (!deviceId) {
    return;
  }

  try {
    const cutoff = new Date(Date.now() - HISTORY_MS);
    await SensorData.destroy({
      where: {
        deviceId,
        timestamp: { [Op.lt]: cutoff },
      },
    });
  } catch (error) {
    logger.warn('HA webhook history prune failed', error && error.message ? error.message : error);
  }
}

// Debug endpoint: accepts any body type, returns parsed JSON or raw text and logs raw payload.
// If `HA_DEBUG_SECRET` is set in the environment, require header `x-debug-secret` to match it.
// Use this to validate HA / PowerShell payload formatting without triggering validation/signature checks.
router.post('/webhook-debug', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (haDebugSecret) {
    const supplied = (req.get('x-debug-secret') || '').toString().trim();
    if (!supplied || supplied !== haDebugSecret) {
      return res.status(401).json({ success: false, message: 'Missing or invalid x-debug-secret header' });
    }
  }
  try {
    const raw = req.rawBody && req.rawBody.length ? req.rawBody : (typeof req.body === 'string' ? Buffer.from(req.body) : null);
    const rawPreview = raw ? raw.toString('utf8').slice(0, Math.min(2048, raw.length)) : null;
    let parsed = null;
    let parseError = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch (err) {
        parseError = String(err && err.message ? err.message : err);
      }
    } else if (req.body && typeof req.body === 'object') {
      parsed = req.body;
    }

    logger.info('HA webhook-debug received', {
      url: req.originalUrl,
      headers: {
        'x-ha-device': req.get('x-ha-device') || null,
        authorization: req.get('authorization') ? 'present' : 'missing',
      },
      rawPreview: rawPreview ? rawPreview.slice(0, 200) : null,
      parsedPresent: !!parsed,
      parseError,
    });

    return res.status(200).json({
      success: true,
      message: 'webhook-debug received',
      parsed,
      parseError,
      rawPreview,
      headers: {
        authorization: req.get('authorization') ? 'present' : 'missing',
        'x-ha-device': req.get('x-ha-device') || null,
        'content-type': req.get('content-type') || null,
      },
    });
  } catch (error) {
    logger.warn('webhook-debug handler failed', error && error.message ? error.message : error);
    return res.status(500).json({
      success: false,
      message: 'webhook-debug failed',
      error: error && error.message ? error.message : String(error),
    });
  }
});

router.post('/webhook', webhookLimiter, [
  body('timestamp').optional({ nullable: true }).isISO8601().withMessage('timestamp must be ISO8601 when provided'),
  body('metrics').optional().isObject().withMessage('metrics must be an object when provided'),
  body('deviceId').optional().isString().isLength({ min: 1, max: 120 }).withMessage('deviceId must be a string'),
], async (req, res) => {
  if (!webhookSecret) {
    return res.status(503).json({ success: false, message: 'HOME_ASSISTANT_WEBHOOK_SECRET is not configured' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  if (!verifySignature(req)) {
    return res.status(401).json({ success: false, message: 'Signature verification failed' });
  }

  const resolvedDeviceId = (req.body.deviceId || req.get('x-ha-device') || homeAssistantDeviceId || '').toString().trim();
  if (!resolvedDeviceId) {
    return res.status(400).json({ success: false, message: 'deviceId is required' });
  }

  const metrics = extractMetrics(req.body);
  if (!hasRealReading(metrics)) {
    return res.status(400).json({ success: false, message: 'At least one numeric metric is required' });
  }

  const timestamp = req.body.timestamp ? new Date(req.body.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid timestamp' });
  }
  if (Math.abs(Date.now() - timestamp.getTime()) > 2 * 60 * 1000) {
    return res.status(422).json({ success: false, message: 'Timestamp is outside the allowed drift (±2 minutes)' });
  }

  const signatureSource = JSON.stringify({ deviceId: resolvedDeviceId, timestamp: timestamp.toISOString(), metrics });
  const dedupeSignature = crypto.createHash('sha256').update(signatureSource).digest('hex');
  if (dedupeCache.get(dedupeSignature)) {
    return res.status(202).json({ success: true, duplicate: true, message: 'Duplicate telemetry ignored' });
  }
  dedupeCache.set(dedupeSignature, true);

  try {
    await deviceManager.markDeviceOnline(resolvedDeviceId, {
      source: 'home_assistant_webhook',
      lastWebhookAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('HA webhook markDeviceOnline failed', error && error.message ? error.message : error);
  }

  const trimmedPayload = clampPayload(req.body);

  try {
    await SensorData.create({
      deviceId: resolvedDeviceId,
      ...metrics,
      timestamp,
      isOfflineData: false,
      source: 'home_assistant',
      rawPayload: trimmedPayload,
    });

    // Persist a device event for auditing
    try {
      await DeviceEvent.create({
        deviceId: resolvedDeviceId,
        eventType: 'webhook',
        payload: trimmedPayload ? JSON.stringify(trimmedPayload) : null,
        timestamp,
        source: 'home_assistant',
      });
    } catch (evErr) {
      logger.warn('Failed to create DeviceEvent for HA webhook', evErr && evErr.message ? evErr.message : evErr);
    }

    // Merge incoming metrics with existing snapshot to avoid overwriting
    // previously-known non-zero values with sparse/zero-filled webhook payloads.
    // Heuristic: if incoming value is exactly 0 and an existing non-zero value
    // exists, preserve the existing value. Null/undefined incoming values will
    // keep the existing value as well. This reduces flicker when partial
    // snapshots containing zeros arrive from Home Assistant.
    try {
      const existingSnapshot = await SensorSnapshot.findOne({ where: { deviceId: resolvedDeviceId }, raw: true });

      const decide = (key) => {
        const incoming = metrics[key];
        if (incoming === null || typeof incoming === 'undefined') {
          return existingSnapshot ? existingSnapshot[key] : null;
        }
        // Preserve existing non-zero when incoming is a spurious 0
        if (typeof incoming === 'number' && incoming === 0 && existingSnapshot && existingSnapshot[key] !== null && existingSnapshot[key] !== 0) {
          return existingSnapshot[key];
        }
        return incoming;
      };

      const snapshotPayload = {
        deviceId: resolvedDeviceId,
        temperature: decide('temperature'),
        humidity: decide('humidity'),
        moisture: decide('moisture'),
        ph: decide('ph'),
        ec: decide('ec'),
        nitrogen: decide('nitrogen'),
        phosphorus: decide('phosphorus'),
        potassium: decide('potassium'),
        waterLevel: decide('waterLevel'),
        floatSensor: decide('floatSensor'),
        batteryLevel: decide('batteryLevel'),
        signalStrength: decide('signalStrength'),
        timestamp,
      };

      await SensorSnapshot.upsert(snapshotPayload);
    } catch (mergeErr) {
      // If merge fails for any reason, fall back to the simple upsert to avoid
      // dropping telemetry entirely.
      logger.warn('HA webhook snapshot merge failed, falling back to simple upsert', mergeErr && mergeErr.message ? mergeErr.message : mergeErr);
      await SensorSnapshot.upsert({
        deviceId: resolvedDeviceId,
        temperature: metrics.temperature,
        humidity: metrics.humidity,
        moisture: metrics.moisture,
        ph: metrics.ph,
        ec: metrics.ec,
        nitrogen: metrics.nitrogen,
        phosphorus: metrics.phosphorus,
        potassium: metrics.potassium,
        waterLevel: metrics.waterLevel,
        floatSensor: metrics.floatSensor,
        batteryLevel: metrics.batteryLevel,
        signalStrength: metrics.signalStrength,
        timestamp,
      });
    }

    await sensorLogService.recordSensorLogs({
      deviceId: resolvedDeviceId,
      metrics,
      origin: 'home_assistant_webhook',
      recordedAt: timestamp,
      rawPayload: trimmedPayload,
    });

    pruneHistory(resolvedDeviceId).catch(() => null);
  } catch (error) {
    logger.error('HA webhook persistence failed', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Failed to persist telemetry' });
  }

  const io = resolveIo(req.app);
  const payload = sanitizeSensorPayload({
    deviceId: resolvedDeviceId,
    ...metrics,
    timestamp,
    source: 'home_assistant',
  });

  try {
    const alerts = await checkThresholds(payload, io);
    if (alerts && alerts.length > 0) {
      payload.alerts = alerts;
    }
    broadcastSensorData(payload, io);
  } catch (error) {
    logger.warn('HA webhook broadcast failed', error && error.message ? error.message : error);
  }

  return res.status(201).json({ success: true, data: payload });
});

// Relaxed webhook: accepts text or malformed JSON payloads commonly sent from Home Assistant
// or PowerShell. Skips signature verification so it's useful for debugging and quick integration.
// NOTE: This endpoint is less secure; enable only for short-term debugging or protect via network ACLs.
router.post('/webhook-relaxed', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  // Attempt to parse the incoming body into JSON.
  let parsedBody = null;
  const raw = req.rawBody && req.rawBody.length ? req.rawBody : (typeof req.body === 'string' ? Buffer.from(req.body) : null);
  if (raw) {
    const txt = raw.toString('utf8').trim();
    // If it's already JSON-like, try parse directly
    try {
      parsedBody = JSON.parse(txt);
    } catch (err) {
      // Some clients send form-encoded or quoted JSON like payload="{...}" - try to unquote
      const maybeMatch = txt.match(/^{[\s\S]*}$|^\"{[\s\S]*}\"$/);
      if (maybeMatch) {
        const candidate = txt.replace(/^\"/, '').replace(/\"$/, '');
        try {
          parsedBody = JSON.parse(candidate);
        } catch (e2) {
          parsedBody = null;
        }
      } else {
        // Try to find a JSON substring inside
        const firstBrace = txt.indexOf('{');
        const lastBrace = txt.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const substr = txt.slice(firstBrace, lastBrace + 1);
          try {
            parsedBody = JSON.parse(substr);
          } catch (e3) {
            parsedBody = null;
          }
        }
      }
    }
  }

  // If body parsed as object by body-parser, use that
  if (!parsedBody && req.body && typeof req.body === 'object') {
    parsedBody = req.body;
  }

  if (!parsedBody) {
    return res.status(400).json({ success: false, message: 'Unable to parse JSON payload (webhook-relaxed)' });
  }

  // From here on, follow same logic as the main webhook but WITHOUT signature verification.
  const resolvedDeviceId = (parsedBody.deviceId || req.get('x-ha-device') || homeAssistantDeviceId || '').toString().trim();
  if (!resolvedDeviceId) {
    return res.status(400).json({ success: false, message: 'deviceId is required' });
  }

  const metrics = extractMetrics(parsedBody);
  if (!hasRealReading(metrics)) {
    return res.status(400).json({ success: false, message: 'At least one numeric metric is required' });
  }

  const timestamp = parsedBody.timestamp ? new Date(parsedBody.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid timestamp' });
  }
  if (Math.abs(Date.now() - timestamp.getTime()) > 5 * 60 * 1000) {
    // Relaxed endpoint allows ±5 minutes drift
    return res.status(422).json({ success: false, message: 'Timestamp is outside the allowed drift (±5 minutes)' });
  }

  const signatureSource = JSON.stringify({ deviceId: resolvedDeviceId, timestamp: timestamp.toISOString(), metrics });
  const dedupeSignature = crypto.createHash('sha256').update(signatureSource).digest('hex');
  if (dedupeCache.get(dedupeSignature)) {
    return res.status(202).json({ success: true, duplicate: true, message: 'Duplicate telemetry ignored' });
  }
  dedupeCache.set(dedupeSignature, true);

  try {
    await deviceManager.markDeviceOnline(resolvedDeviceId, {
      source: 'home_assistant_webhook_relaxed',
      lastWebhookAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('HA webhook-relaxed markDeviceOnline failed', error && error.message ? error.message : error);
  }

  const trimmedPayload = clampPayload(parsedBody);

  try {
    await SensorData.create({
      deviceId: resolvedDeviceId,
      ...metrics,
      timestamp,
      isOfflineData: false,
      source: 'home_assistant_relaxed',
      rawPayload: trimmedPayload,
    });

    try {
      await DeviceEvent.create({
        deviceId: resolvedDeviceId,
        eventType: 'webhook_relaxed',
        payload: trimmedPayload ? JSON.stringify(trimmedPayload) : null,
        timestamp,
        source: 'home_assistant_relaxed',
      });
    } catch (evErr) {
      logger.warn('Failed to create DeviceEvent for HA webhook-relaxed', evErr && evErr.message ? evErr.message : evErr);
    }

    // Merge incoming metrics with existing snapshot to avoid overwriting
    // previously-known non-zero values with sparse/zero-filled webhook payloads.
    try {
      const existingSnapshot = await SensorSnapshot.findOne({ where: { deviceId: resolvedDeviceId }, raw: true });
      const decide = (key) => {
        const incoming = metrics[key];
        if (incoming === null || typeof incoming === 'undefined') {
          return existingSnapshot ? existingSnapshot[key] : null;
        }
        if (typeof incoming === 'number' && incoming === 0 && existingSnapshot && existingSnapshot[key] !== null && existingSnapshot[key] !== 0) {
          return existingSnapshot[key];
        }
        return incoming;
      };
      const snapshotPayload = {
        deviceId: resolvedDeviceId,
        temperature: decide('temperature'),
        humidity: decide('humidity'),
        moisture: decide('moisture'),
        ph: decide('ph'),
        ec: decide('ec'),
        nitrogen: decide('nitrogen'),
        phosphorus: decide('phosphorus'),
        potassium: decide('potassium'),
        waterLevel: decide('waterLevel'),
        floatSensor: decide('floatSensor'),
        batteryLevel: decide('batteryLevel'),
        signalStrength: decide('signalStrength'),
        timestamp,
      };
      await SensorSnapshot.upsert(snapshotPayload);
    } catch (mergeErr) {
      logger.warn('HA webhook-relaxed snapshot merge failed, falling back to simple upsert', mergeErr && mergeErr.message ? mergeErr.message : mergeErr);
      await SensorSnapshot.upsert({
        deviceId: resolvedDeviceId,
        temperature: metrics.temperature,
        humidity: metrics.humidity,
        moisture: metrics.moisture,
        ph: metrics.ph,
        ec: metrics.ec,
        nitrogen: metrics.nitrogen,
        phosphorus: metrics.phosphorus,
        potassium: metrics.potassium,
        waterLevel: metrics.waterLevel,
        floatSensor: metrics.floatSensor,
        batteryLevel: metrics.batteryLevel,
        signalStrength: metrics.signalStrength,
        timestamp,
      });
    }

    await sensorLogService.recordSensorLogs({
      deviceId: resolvedDeviceId,
      metrics,
      origin: 'home_assistant_webhook_relaxed',
      recordedAt: timestamp,
      rawPayload: trimmedPayload,
    });

    pruneHistory(resolvedDeviceId).catch(() => null);
  } catch (error) {
    logger.error('HA webhook-relaxed persistence failed', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Failed to persist telemetry' });
  }

  const io = resolveIo(req.app);
  const payload = sanitizeSensorPayload({
    deviceId: resolvedDeviceId,
    ...metrics,
    timestamp,
    source: 'home_assistant_relaxed',
  });

  try {
    const alerts = await checkThresholds(payload, io);
    if (alerts && alerts.length > 0) {
      payload.alerts = alerts;
    }
    broadcastSensorData(payload, io);
  } catch (error) {
    logger.warn('HA webhook-relaxed broadcast failed', error && error.message ? error.message : error);
  }

  return res.status(201).json({ success: true, data: payload });
});

router.post('/float', [
  body('level').exists().withMessage('level is required'),
  body('deviceId').optional().isString().isLength({ min: 1, max: 120 }),
  body('pumpState').optional().isLength({ min: 1, max: 120 }),
  body('pump_state').optional().isLength({ min: 1, max: 120 }),
  body('mode').optional().isLength({ min: 1, max: 120 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const resolvedDeviceId = (req.body.deviceId || req.body.device_id || homeAssistantDeviceId || '').toString().trim();
  if (!resolvedDeviceId) {
    return res.status(400).json({ success: false, message: 'deviceId is required' });
  }

  const levelInput = req.body.level ?? req.body.float ?? req.body.float_state ?? req.body.floatSensor;
  const normalizedLevel = normalizeFloatLevel(levelInput);
  if (normalizedLevel === null) {
    return res.status(422).json({ success: false, message: 'Unable to interpret float level (expected HIGH/LOW)' });
  }

  const pumpInput = req.body.pumpState ?? req.body.pump_state ?? req.body.pump;
  const normalizedPump = typeof pumpInput !== 'undefined' ? normalizePumpState(pumpInput) : null;

  const modeInput = req.body.mode ?? req.body.control_mode ?? req.body.pumpMode;
  const normalizedMode = modeInput ? normalizePumpMode(modeInput) : null;

  const timestamp = new Date();
  const snapshotPayload = {
    deviceId: resolvedDeviceId,
    floatSensor: normalizedLevel,
    waterLevel: normalizedLevel,
    timestamp,
    source: 'home_assistant_float',
  };

  try {
    await deviceManager.markDeviceOnline(resolvedDeviceId, {
      source: 'home_assistant_float',
      lastHomeAssistantFloat: timestamp.toISOString(),
    });
  } catch (error) {
    logger.warn('HA float endpoint markDeviceOnline failed', error && error.message ? error.message : error);
  }

  try {
    await SensorData.create({
      ...snapshotPayload,
      isOfflineData: false,
      rawPayload: clampPayload(req.body),
    });

    // Persist a device event for float/webhook actions
    try {
      await DeviceEvent.create({
        deviceId: resolvedDeviceId,
        eventType: 'float',
        payload: clampPayload(req.body) ? JSON.stringify(clampPayload(req.body)) : null,
        timestamp,
        source: 'home_assistant_float',
      });
    } catch (evErr) {
      logger.warn('Failed to create DeviceEvent for HA float', evErr && evErr.message ? evErr.message : evErr);
    }

    await SensorSnapshot.upsert({
      deviceId: resolvedDeviceId,
      floatSensor: normalizedLevel,
      waterLevel: normalizedLevel,
      temperature: null,
      humidity: null,
      moisture: null,
      ph: null,
      ec: null,
      nitrogen: null,
      phosphorus: null,
      potassium: null,
      batteryLevel: null,
      signalStrength: null,
      timestamp,
    });

    pruneHistory(resolvedDeviceId).catch(() => null);
  } catch (error) {
    logger.error('HA float endpoint persistence failed', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Failed to persist float telemetry' });
  }

  let actuatorState = null;
  try {
    actuatorState = await syncPumpFromHa({
      desiredState: normalizedPump,
      desiredMode: normalizedMode,
      deviceId: resolvedDeviceId,
    });
  } catch (error) {
    logger.warn('HA float endpoint actuator sync failed', error && error.message ? error.message : error);
  }

  const io = resolveIo(req.app);
  const sanitized = sanitizeSensorPayload(snapshotPayload);

  try {
    const alerts = await checkThresholds(sanitized, io);
    if (alerts && alerts.length > 0) {
      sanitized.alerts = alerts;
    }
    broadcastSensorData(sanitized, io);
  } catch (error) {
    logger.warn('HA float endpoint broadcast failed', error && error.message ? error.message : error);
  }

  return res.status(201).json({
    success: true,
    data: {
      ...sanitized,
      pumpState: normalizedPump === null ? null : (normalizedPump ? 'ON' : 'OFF'),
      pumpMode: normalizedMode,
      actuator: actuatorState || null,
    },
  });
});

router.get('/history', auth, [
  query('deviceId').optional().isString().isLength({ min: 1, max: 120 }),
  query('since').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 2000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const deviceId = (req.query.deviceId || req.query.device_id || homeAssistantDeviceId || '').toString().trim();
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - HISTORY_MS);
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 500;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: 'deviceId is required' });
  }
  if (Number.isNaN(since.getTime())) {
    return res.status(400).json({ success: false, message: 'since must be a valid ISO timestamp' });
  }

  try {
    const rows = await SensorData.findAll({
      where: {
        deviceId,
        timestamp: { [Op.gte]: since },
      },
      order: [['timestamp', 'DESC']],
      limit,
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        deviceId,
        since: since.toISOString(),
        readings: rows.map((row) => sanitizeSensorPayload(row, [])),
      },
    });
  } catch (error) {
    logger.error('HA history fetch failed', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
});

module.exports = router;
