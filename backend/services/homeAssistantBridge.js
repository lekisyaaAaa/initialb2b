const WebSocket = require('ws');
const axios = require('axios');
const { Op } = require('sequelize');

const logger = require('../utils/logger');
const SensorData = require('../models/SensorData');
const SensorSnapshot = require('../models/SensorSnapshot');
const { toPlainObject } = require('../utils/sensorFormatting');
const { resolveIo, broadcastSensorData, checkThresholds } = require('../utils/sensorEvents');
const deviceManager = require('./deviceManager');

const ALLOWED_FIELDS = new Set([
  'temperature',
  'humidity',
  'moisture',
  'ph',
  'ec',
  'nitrogen',
  'phosphorus',
  'potassium',
  'waterLevel',
  'floatSensor',
  'batteryLevel',
  'signalStrength',
]);

function resolveFieldName(field) {
  if (typeof field !== 'string') {
    return field;
  }
  const trimmed = field.trim();
  if (ALLOWED_FIELDS.has(trimmed)) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  // Attempt to match case-insensitively against the known field list
  // to avoid fragile casing issues in the mapping file.
  for (const candidate of ALLOWED_FIELDS) {
    if (candidate.toLowerCase() === lower) {
      return candidate;
    }
  }
  return trimmed;
}

const DEFAULT_DEBOUNCE_MS = Math.max(50, parseInt(process.env.HOME_ASSISTANT_FLUSH_DEBOUNCE_MS || '250', 10));
const MAX_BACKOFF_MS = Math.max(1000, parseInt(process.env.HOME_ASSISTANT_MAX_BACKOFF_MS || '60000', 10));
const STARTUP_DELAY_MS = Math.max(0, parseInt(process.env.HOME_ASSISTANT_START_DELAY_MS || '0', 10));
const historyDays = Number.parseInt(process.env.HOME_ASSISTANT_HISTORY_DAYS || process.env.HA_HISTORY_RETENTION_DAYS || '7', 10);
const HISTORY_MS = Math.max(1, historyDays || 7) * 24 * 60 * 60 * 1000;

let state = {
  config: null,
  ws: null,
  pingTimer: null,
  reconnectTimer: null,
  flushTimer: null,
  latestEventTimestamp: null,
  latestValues: {},
  entityConfig: new Map(),
  started: false,
  shuttingDown: false,
  connectionAttempts: 0,
  messageId: 1,
  lastSnapshotSignature: null,
  hydrating: false,
  lastConnectAt: null,
  lastDisconnectAt: null,
  lastErrorMessage: null,
};

const defaultBooleanStrings = {
  on: 1,
  true: 1,
  open: 1,
  detected: 1,
  wet: 1,
  active: 1,
  yes: 1,
  '1': 1,
  off: 0,
  false: 0,
  closed: 0,
  clear: 0,
  dry: 0,
  inactive: 0,
  no: 0,
  '0': 0,
};

function nextMessageId() {
  state.messageId += 1;
  return state.messageId;
}

function parseBooleanFlag(value) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return Boolean(value);
}

function parseJsonOrStringMap(raw) {
  if (!raw || typeof raw !== 'string') {
    return {};
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (error) {
      logger.warn('[HA Bridge] Failed to parse HOME_ASSISTANT_SENSOR_MAP JSON, falling back to CSV form', error && error.message ? error.message : error);
    }
  }
  const map = {};
  trimmed.split(',').forEach((segment) => {
    const pair = segment.split('=');
    if (pair.length === 2) {
      const field = pair[0].trim();
      const entity = pair[1].trim();
      if (field && entity) {
        map[field] = entity;
      }
    }
  });
  return map;
}

function normalizeValueMap(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const out = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (key === undefined || key === null) {
      return;
    }
    out[String(key).toLowerCase()] = value;
  });
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeFieldConfig(field, rawConfig) {
  if (!rawConfig) {
    return null;
  }

  const resolvedField = resolveFieldName(field);
  const config = { field: resolvedField };

  if (typeof rawConfig === 'string') {
    config.entity = rawConfig.trim();
  } else if (typeof rawConfig === 'object') {
    const candidate = rawConfig.entity || rawConfig.entity_id || rawConfig.id;
    if (!candidate || typeof candidate !== 'string') {
      return null;
    }
    config.entity = candidate.trim();
    if (rawConfig.attribute && typeof rawConfig.attribute === 'string') {
      config.attribute = rawConfig.attribute.trim();
    } else if (rawConfig.attr && typeof rawConfig.attr === 'string') {
      config.attribute = rawConfig.attr.trim();
    }
    if (rawConfig.valueMap || rawConfig.value_map || rawConfig.map || rawConfig.values) {
      config.valueMap = normalizeValueMap(rawConfig.valueMap || rawConfig.value_map || rawConfig.map || rawConfig.values);
    }
    if (typeof rawConfig.factor === 'number') {
      config.factor = rawConfig.factor;
    } else if (typeof rawConfig.scale === 'number') {
      config.factor = rawConfig.scale;
    }
    if (typeof rawConfig.offset === 'number') {
      config.offset = rawConfig.offset;
    }
    if (typeof rawConfig.precision === 'number' && Number.isFinite(rawConfig.precision) && rawConfig.precision >= 0) {
      config.precision = Math.floor(rawConfig.precision);
    }
    if (parseBooleanFlag(rawConfig.integer) || parseBooleanFlag(rawConfig.asInteger)) {
      config.asInteger = true;
    }
    if (parseBooleanFlag(rawConfig.boolean) || (typeof rawConfig.type === 'string' && rawConfig.type.toLowerCase() === 'boolean') || parseBooleanFlag(rawConfig.asBoolean)) {
      config.boolean = true;
    }
    if (typeof rawConfig.type === 'string' && rawConfig.type.toLowerCase() === 'binary') {
      config.boolean = true;
      config.asInteger = true;
    }
  } else {
    logger.warn('[HA Bridge] Unsupported config format for field', field);
    return null;
  }

  if (!config.entity) {
    return null;
  }

  if (!ALLOWED_FIELDS.has(resolvedField)) {
    logger.warn('[HA Bridge] Ignoring mapping for unsupported field', resolvedField, '→', config.entity);
    return null;
  }

  if ((resolvedField === 'floatSensor' || resolvedField === 'waterLevel') && config.boolean === undefined) {
    config.boolean = true;
    config.asInteger = true;
  }

  return config;
}

function collectSensorConfigs() {
  const mapFromEnv = parseJsonOrStringMap(process.env.HOME_ASSISTANT_SENSOR_MAP || process.env.HA_SENSOR_MAP || '');
  const fieldConfigMap = new Map();

  Object.entries(mapFromEnv).forEach(([field, raw]) => {
    const normalizedField = typeof field === 'string' ? field.trim() : field;
    const config = normalizeFieldConfig(normalizedField, raw);
    if (config) {
      fieldConfigMap.set(config.field, config);
    }
  });

  ALLOWED_FIELDS.forEach((field) => {
    const envKey = `HOME_ASSISTANT_${field.toUpperCase()}_ENTITY`;
    if (process.env[envKey]) {
      const config = normalizeFieldConfig(field, process.env[envKey]);
      if (config) {
        fieldConfigMap.set(field, config);
      }
    }
  });

  return Array.from(fieldConfigMap.values());
}

function buildConfig() {
  const token = (process.env.HOME_ASSISTANT_TOKEN
    || process.env.HOME_ASSISTANT_LONG_LIVED_TOKEN
    || process.env.HA_LONG_LIVED_TOKEN
    || process.env.HA_TOKEN
    || '').trim();

  const baseUrlRaw = (process.env.HOME_ASSISTANT_BASE_URL
    || process.env.HOME_ASSISTANT_URL
    || process.env.HA_BASE_URL
    || '').trim().replace(/\/$/, '');

  const explicitWsUrl = (process.env.HOME_ASSISTANT_WS_URL
    || process.env.HA_WS_URL
    || '').trim();

  let wsUrl = explicitWsUrl;
  if (!wsUrl && baseUrlRaw) {
    if (/^https/i.test(baseUrlRaw)) {
      wsUrl = `${baseUrlRaw.replace(/^https/i, 'wss')}/api/websocket`;
    } else if (/^http/i.test(baseUrlRaw)) {
      wsUrl = `${baseUrlRaw.replace(/^http/i, 'ws')}/api/websocket`;
    }
  }
  wsUrl = wsUrl ? wsUrl.replace(/\/$/, '') : '';

  const restBaseUrl = baseUrlRaw || (wsUrl ? wsUrl.replace(/^wss/i, 'https').replace(/^ws/i, 'http').replace(/\/api\/websocket$/, '') : '');

  const sensorConfigs = collectSensorConfigs();

  const deviceId = (process.env.HOME_ASSISTANT_DEVICE_ID
    || process.env.PRIMARY_DEVICE_ID
    || 'home-assistant-bridge').trim();

  const allowInsecureTls = parseBooleanFlag(process.env.HOME_ASSISTANT_ALLOW_INSECURE_TLS || process.env.HA_ALLOW_INSECURE_TLS);
  const rawEnabled = process.env.ENABLE_HOME_ASSISTANT_BRIDGE
    || process.env.HOME_ASSISTANT_BRIDGE
    || process.env.HA_BRIDGE;
  const enabled = rawEnabled !== undefined && rawEnabled !== null
    ? parseBooleanFlag(rawEnabled)
    : false;

  return {
    enabled,
    token,
    wsUrl,
    restBaseUrl,
    sensorConfigs,
    deviceId,
    allowInsecureTls,
  };
}

function signatureForSnapshot(snapshot) {
  const relevant = {};
  const keys = Object.keys(snapshot).filter((key) => key !== 'timestamp' && key !== 'deviceId');
  keys.sort();
  keys.forEach((key) => {
    relevant[key] = snapshot[key];
  });
  return JSON.stringify(relevant);
}

function extractValueFromState(newState, config) {
  if (!newState || typeof newState !== 'object') {
    return null;
  }

  let rawValue;

  if (config.attribute) {
    const attributes = newState.attributes || {};
    rawValue = attributes && Object.prototype.hasOwnProperty.call(attributes, config.attribute)
      ? attributes[config.attribute]
      : undefined;
  } else {
    rawValue = newState.state;
  }

  if (rawValue === null || typeof rawValue === 'undefined') {
    return null;
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === 'unknown' || trimmed === 'unavailable') {
      return null;
    }
    if (config.valueMap) {
      const mapped = config.valueMap[trimmed.toLowerCase()] ?? config.valueMap[trimmed];
      if (typeof mapped !== 'undefined') {
        rawValue = mapped;
      } else {
        rawValue = trimmed;
      }
    } else {
      rawValue = trimmed;
    }
  } else if (config.valueMap) {
    const key = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
    const mapped = config.valueMap[String(key).toLowerCase()] ?? config.valueMap[key];
    if (typeof mapped !== 'undefined') {
      rawValue = mapped;
    }
  }

  if (config.boolean) {
    if (typeof rawValue === 'string') {
      const mapped = defaultBooleanStrings[rawValue.toLowerCase()];
      if (mapped !== undefined) {
        rawValue = mapped;
      }
    } else if (typeof rawValue === 'boolean') {
      rawValue = rawValue ? 1 : 0;
    }
  }

  if (typeof rawValue === 'string') {
    const maybe = Number.parseFloat(rawValue);
    if (!Number.isNaN(maybe)) {
      rawValue = maybe;
    }
  } else if (typeof rawValue === 'boolean') {
    rawValue = rawValue ? 1 : 0;
  }

  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) {
      return null;
    }
    let computed = rawValue;
    if (typeof config.factor === 'number') {
      computed *= config.factor;
    }
    if (typeof config.offset === 'number') {
      computed += config.offset;
    }
    if (config.asInteger) {
      computed = Math.round(computed);
    } else if (typeof config.precision === 'number') {
      const precision = Math.max(0, Math.min(6, config.precision));
      const multiplier = 10 ** precision;
      computed = Math.round(computed * multiplier) / multiplier;
    }
    return computed;
  }

  return null;
}

function hasMeaningfulChange(previous, next) {
  if (previous === null && next === null) {
    return false;
  }
  if (typeof previous === 'number' && typeof next === 'number') {
    return Math.abs(previous - next) > 0.0001;
  }
  return previous !== next;
}

function scheduleFlush(triggerTimestamp) {
  state.latestEventTimestamp = triggerTimestamp || new Date().toISOString();
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
  }
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    flushSnapshot().catch((error) => {
      logger.warn('[HA Bridge] Failed to flush snapshot', error && error.message ? error.message : error);
    });
  }, DEFAULT_DEBOUNCE_MS);
}

function parseTimestamp(input) {
  if (!input) {
    return new Date();
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function buildSnapshot() {
  if (!state.config) {
    return null;
  }

  const timestamp = parseTimestamp(state.latestEventTimestamp);
  const payload = {
    deviceId: state.config.deviceId,
    timestamp,
  };

  state.entityConfig.forEach((configs) => {
    configs.forEach((cfg) => {
      if (Object.prototype.hasOwnProperty.call(state.latestValues, cfg.field)) {
        payload[cfg.field] = state.latestValues[cfg.field];
      }
    });
  });

  return payload;
}

function sanitizeSnapshotForPersistence(snapshot) {
  if (!snapshot || !snapshot.deviceId) {
    return null;
  }

  let timestamp = snapshot.timestamp instanceof Date ? snapshot.timestamp : new Date(snapshot.timestamp || Date.now());
  if (Number.isNaN(timestamp.getTime())) {
    timestamp = new Date();
  }

  const sanitized = {
    deviceId: snapshot.deviceId,
    timestamp,
  };

  ALLOWED_FIELDS.forEach((field) => {
    const value = snapshot[field];
    sanitized[field] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  });

  return sanitized;
}

function hasRealReading(snapshot) {
  const { temperature, humidity, moisture, floatSensor, waterLevel } = snapshot;
  return (
    typeof temperature === 'number'
    || typeof humidity === 'number'
    || typeof moisture === 'number'
    || typeof floatSensor === 'number'
    || typeof waterLevel === 'number'
  );
}

async function flushSnapshot() {
  const rawSnapshot = buildSnapshot();
  if (!rawSnapshot) {
    return;
  }

  const snapshot = sanitizeSnapshotForPersistence(rawSnapshot);
  if (!snapshot) {
    return;
  }

  const signature = signatureForSnapshot(snapshot);
  if (signature === state.lastSnapshotSignature) {
    return;
  }

  if (!hasRealReading(snapshot)) {
    logger.debug('[HA Bridge] Ignoring snapshot without real telemetry');
    return;
  }

  try {
    await deviceManager.markDeviceOnline(state.config.deviceId, {
      source: 'home-assistant-bridge',
      lastHomeAssistantUpdate: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('[HA Bridge] Failed to mark device online', error && error.message ? error.message : error);
  }

  let record;
  try {
    record = await SensorData.create({
      ...snapshot,
      isOfflineData: false,
      source: 'home_assistant_bridge',
      rawPayload: null,
    });
    state.lastSnapshotSignature = signature;
    await SensorSnapshot.upsert({
      deviceId: snapshot.deviceId,
      temperature: snapshot.temperature,
      humidity: snapshot.humidity,
      moisture: snapshot.moisture,
      ph: snapshot.ph,
      ec: snapshot.ec,
      nitrogen: snapshot.nitrogen,
      phosphorus: snapshot.phosphorus,
      potassium: snapshot.potassium,
      waterLevel: snapshot.waterLevel,
      floatSensor: snapshot.floatSensor,
      batteryLevel: snapshot.batteryLevel,
      signalStrength: snapshot.signalStrength,
      timestamp: snapshot.timestamp,
    });
    pruneHistory(snapshot.deviceId).catch(() => null);
  } catch (error) {
    logger.error('[HA Bridge] Failed to persist sensor data', error && error.message ? error.message : error, snapshot);
    return;
  }

  const io = resolveIo();
  try {
    const alerts = await checkThresholds(record, io);
    const plain = toPlainObject(record) || snapshot;
    const payload = alerts.length > 0 ? { ...plain, alerts } : plain;
    broadcastSensorData(payload, io);
  } catch (error) {
    logger.warn('[HA Bridge] Failed during broadcast/alert processing', error && error.message ? error.message : error);
  }
}

function applyNewState(entityId, newState) {
  const configs = state.entityConfig.get(entityId.toLowerCase());
  if (!configs || configs.length === 0) {
    return false;
  }

  let changed = false;
  configs.forEach((cfg) => {
    const value = extractValueFromState(newState, cfg);
    if (typeof state.latestValues[cfg.field] === 'undefined') {
      state.latestValues[cfg.field] = null;
    }
    if (!hasMeaningfulChange(state.latestValues[cfg.field], value)) {
      return;
    }
    state.latestValues[cfg.field] = value;
    changed = true;
  });

  if (changed) {
    const triggerTs = newState && (newState.last_changed || newState.last_updated) ? newState.last_changed || newState.last_updated : new Date().toISOString();
    scheduleFlush(triggerTs);
  }

  return changed;
}

async function hydrateInitialState() {
  if (!state.config || !state.config.restBaseUrl || !state.config.token) {
    return;
  }
  if (state.hydrating) {
    return;
  }
  const uniqueEntities = Array.from(state.entityConfig.keys());
  if (uniqueEntities.length === 0) {
    return;
  }

  state.hydrating = true;
  try {
    const headers = { Authorization: `Bearer ${state.config.token}` };
    await Promise.all(uniqueEntities.map(async (entityId) => {
      try {
        const url = `${state.config.restBaseUrl.replace(/\/$/, '')}/api/states/${entityId}`;
        const response = await axios.get(url, { headers, timeout: 5000 });
        if (response && response.data) {
          applyNewState(entityId, response.data);
        }
      } catch (error) {
        logger.warn('[HA Bridge] Initial state fetch failed for', entityId, error && error.message ? error.message : error);
      }
    }));
  } finally {
    state.hydrating = false;
  }
}

function sendWsMessage(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    state.ws.send(JSON.stringify(payload));
  } catch (error) {
    logger.warn('[HA Bridge] Failed to send WS message', error && error.message ? error.message : error);
  }
}

function subscribeToEvents() {
  sendWsMessage({ id: nextMessageId(), type: 'subscribe_events', event_type: 'state_changed' });
  sendWsMessage({ id: nextMessageId(), type: 'subscribe_events', event_type: 'homeassistant_started' });
}

function startPing() {
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
  }
  state.pingTimer = setInterval(() => {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      sendWsMessage({ id: nextMessageId(), type: 'ping' });
    }
  }, 30000);
}

function handleAuthRequired() {
  if (!state.config || !state.config.token) {
    logger.error('[HA Bridge] Home Assistant requested auth but token is not configured. Closing connection.');
    if (state.ws) {
      state.ws.close();
    }
    return;
  }
  sendWsMessage({ type: 'auth', access_token: state.config.token });
}

function handleWsMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch (error) {
    logger.warn('[HA Bridge] Received non-JSON message from Home Assistant');
    return;
  }

  if (!message || typeof message !== 'object') {
    return;
  }

  switch (message.type) {
    case 'auth_required':
      handleAuthRequired();
      return;
    case 'auth_ok':
      logger.info('[HA Bridge] Authenticated with Home Assistant');
      subscribeToEvents();
      startPing();
      hydrateInitialState().catch((error) => {
        logger.warn('[HA Bridge] Initial hydration failed after auth', error && error.message ? error.message : error);
      });
      return;
    case 'auth_invalid':
      logger.error('[HA Bridge] Authentication rejected by Home Assistant', message.message || '');
      if (state.ws) {
        state.ws.close();
      }
      return;
    case 'event': {
      if (!message.event) {
        return;
      }
      const { event } = message;
      if (event.event_type === 'state_changed' && event.data && event.data.entity_id) {
        const entityId = String(event.data.entity_id).toLowerCase();
        applyNewState(entityId, event.data.new_state || {});
      } else if (event.event_type === 'homeassistant_started') {
        hydrateInitialState().catch((error) => {
          logger.warn('[HA Bridge] Hydration after restart failed', error && error.message ? error.message : error);
        });
      }
      return;
    }
    case 'result':
    case 'pong':
    case 'ping':
      return;
    default:
      logger.debug('[HA Bridge] Ignoring message type', message.type);
  }
}

function cleanupConnection() {
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  if (state.ws) {
    try {
      state.ws.removeAllListeners();
      state.ws.close();
    } catch (error) {
      // ignore errors while closing
    }
    state.ws = null;
  }
}

function scheduleReconnect(reason) {
  if (state.shuttingDown) {
    return;
  }
  if (state.reconnectTimer) {
    return;
  }
  const attempt = state.connectionAttempts;
  const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempt, 6));
  logger.warn('[HA Bridge] Scheduling reconnect in', delay, 'ms. Reason:', reason || 'unknown');
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (!state.config || !state.config.wsUrl) {
    logger.warn('[HA Bridge] WebSocket URL not configured; cannot connect');
    return;
  }
  if (state.ws) {
    return;
  }

  state.connectionAttempts += 1;
  const attempt = state.connectionAttempts;
  logger.info('[HA Bridge] Connecting to Home Assistant', state.config.wsUrl, `(attempt ${attempt})`);

  const options = {};
  if (state.config.allowInsecureTls) {
    options.rejectUnauthorized = false;
  }

  state.ws = new WebSocket(state.config.wsUrl, options);

  state.ws.on('open', () => {
    logger.info('[HA Bridge] WebSocket connection established');
    state.connectionAttempts = 0;
    state.lastConnectAt = new Date().toISOString();
    state.lastErrorMessage = null;
  });

  state.ws.on('message', handleWsMessage);

  state.ws.on('close', (code, reason) => {
    logger.warn('[HA Bridge] WebSocket closed', code, reason ? reason.toString() : '');
    state.lastDisconnectAt = new Date().toISOString();
    state.lastErrorMessage = reason ? reason.toString() : state.lastErrorMessage;
    cleanupConnection();
    scheduleReconnect('socket closed');
  });

  state.ws.on('error', (error) => {
    logger.error('[HA Bridge] WebSocket error', error && error.message ? error.message : error);
    state.lastDisconnectAt = new Date().toISOString();
    state.lastErrorMessage = error && error.message ? error.message : 'socket error';
    cleanupConnection();
    scheduleReconnect(error && error.message ? error.message : 'socket error');
  });
}

function initializeState(config) {
  state = {
    ...state,
    config,
    ws: null,
    pingTimer: null,
    reconnectTimer: null,
    flushTimer: null,
    latestEventTimestamp: null,
    latestValues: {},
    entityConfig: new Map(),
    started: true,
    shuttingDown: false,
    connectionAttempts: 0,
    messageId: 1,
    lastSnapshotSignature: null,
    hydrating: false,
    lastConnectAt: null,
    lastDisconnectAt: null,
    lastErrorMessage: null,
  };

  config.sensorConfigs.forEach((cfg) => {
    const entityKey = cfg.entity.toLowerCase();
    if (!state.entityConfig.has(entityKey)) {
      state.entityConfig.set(entityKey, []);
    }
    state.entityConfig.get(entityKey).push(cfg);
    if (typeof state.latestValues[cfg.field] === 'undefined') {
      state.latestValues[cfg.field] = null;
    }
  });
}

function start(options = {}) {
  if (state.started) {
    return { stop };
  }

  const config = buildConfig();

  if (!config.enabled) {
    logger.info('[HA Bridge] Disabled via configuration');
    return {
      stop: async () => {},
    };
  }

  if (!config.wsUrl) {
    logger.warn('[HA Bridge] HOME_ASSISTANT_WS_URL (or derived ws url) not provided; bridge disabled');
    return {
      stop: async () => {},
    };
  }

  if (!config.token) {
    logger.warn('[HA Bridge] HOME_ASSISTANT_TOKEN not provided; bridge disabled');
    return {
      stop: async () => {},
    };
  }

  if (!config.sensorConfigs || config.sensorConfigs.length === 0) {
    logger.warn('[HA Bridge] No sensor mappings configured; bridge disabled');
    return {
      stop: async () => {},
    };
  }

  initializeState(config);

  const startDelay = options.startDelayMs !== undefined ? options.startDelayMs : STARTUP_DELAY_MS;

  if (startDelay > 0) {
    logger.info('[HA Bridge] Delaying connection start by', startDelay, 'ms');
    setTimeout(() => {
      if (!state.shuttingDown) {
        hydrateInitialState().catch((error) => {
          logger.warn('[HA Bridge] Initial hydration failed before connect', error && error.message ? error.message : error);
        });
        connect();
      }
    }, startDelay);
  } else {
    hydrateInitialState().catch((error) => {
      logger.warn('[HA Bridge] Initial hydration failed before connect', error && error.message ? error.message : error);
    });
    connect();
  }

  return { stop };
}

async function stop() {
  state.shuttingDown = true;
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  if (state.pingTimer) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  cleanupConnection();
  state.started = false;
}

function collectMappedFields(sourceConfig) {
  const fields = new Set();
  if (state.entityConfig && state.entityConfig.size > 0) {
    state.entityConfig.forEach((configs) => {
      configs.forEach((cfg) => fields.add(cfg.field));
    });
  } else if (sourceConfig && Array.isArray(sourceConfig.sensorConfigs)) {
    sourceConfig.sensorConfigs.forEach((cfg) => {
      if (cfg && cfg.field) {
        fields.add(cfg.field);
      }
    });
  }
  return fields;
}

function getStatus() {
  const config = state.config || buildConfig();
  const mappedFields = collectMappedFields(config);
  const connected = Boolean(state.ws && state.ws.readyState === WebSocket.OPEN);
  const timestamp = new Date().toISOString();

  return {
    timestamp,
    enabled: Boolean(config && config.enabled),
    configured: Boolean(config && config.wsUrl && config.token && mappedFields.size > 0),
    started: Boolean(state.started),
    connected,
    reconnectScheduled: Boolean(state.reconnectTimer),
    hydrating: Boolean(state.hydrating),
    pendingFlush: Boolean(state.flushTimer),
    websocketUrl: config && config.wsUrl ? config.wsUrl : null,
    restBaseUrl: config && config.restBaseUrl ? config.restBaseUrl : null,
    deviceId: config && config.deviceId ? config.deviceId : null,
    allowInsecureTls: Boolean(config && config.allowInsecureTls),
    connectionAttempts: state.connectionAttempts,
    latestEventTimestamp: state.latestEventTimestamp,
    lastConnectAt: state.lastConnectAt,
    lastDisconnectAt: state.lastDisconnectAt,
    lastErrorMessage: state.lastErrorMessage,
    mappedFields: Array.from(mappedFields),
    entityCount: state.entityConfig ? state.entityConfig.size : mappedFields.size,
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  _internal: {
    buildConfig,
    collectSensorConfigs,
    extractValueFromState,
    applyNewState,
    hasMeaningfulChange,
  },
};

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
    }).catch(() => {});
  } catch (error) {
    logger.warn('[HA Bridge] History prune failed', error && error.message ? error.message : error);
  }
}