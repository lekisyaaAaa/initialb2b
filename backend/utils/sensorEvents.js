const Alert = require('../models/Alert');
const Settings = require('../models/Settings');
const logger = require('./logger');
const {
  toPlainObject,
  ensureIsoString,
  sanitizeSensorPayload,
  sanitizeAlertPayload,
  buildSensorSummary,
} = require('./sensorFormatting');
const { REALTIME_EVENTS, emitRealtime } = require('./realtime');

const resolveIo = (app) => {
  if (app && typeof app.get === 'function') {
    const ioInstance = app.get('io');
    if (ioInstance) {
      return ioInstance;
    }
  }
  return global.io;
};

const broadcastSensorData = (data, ioInstance) => {
  const payload = sanitizeSensorPayload(data, data && data.alerts ? data.alerts : []);
  const summary = buildSensorSummary(payload);
  payload.sensorSummary = summary;
  payload.isStale = false;
  payload.receivedAt = ensureIsoString(new Date());

  if (global.wsConnections && global.wsConnections.size > 0) {
    const message = JSON.stringify({
      type: 'sensor_data',
      data: payload,
    });

    global.wsConnections.forEach((ws) => {
      if (ws.readyState === 1) {
        try {
          ws.send(message);
          if (Array.isArray(summary) && summary.length > 0) {
            ws.send(JSON.stringify({
              type: 'device_sensor_summary',
              deviceId: payload.deviceId || null,
              sensors: summary,
              timestamp: payload.timestamp,
            }));
          }
        } catch (error) {
          console.error('WebSocket send error:', error);
          global.wsConnections.delete(ws);
        }
      }
    });
  }

  const io = ioInstance || global.io;
  emitRealtime(REALTIME_EVENTS.SENSOR_UPDATE, payload, { io });
  if (Array.isArray(summary) && summary.length > 0) {
    emitRealtime(REALTIME_EVENTS.SENSOR_SUMMARY, {
      deviceId: payload.deviceId || null,
      sensors: summary,
      timestamp: payload.timestamp,
      isStale: false,
    }, { io });
  }

  return payload;
};

const checkThresholds = async (sensorData, ioInstance) => {
  try {
    const plainSensor = toPlainObject(sensorData) || {};

    if (plainSensor.isOfflineData) {
      return [];
    }

    try {
      const rawTimestamp = plainSensor.timestamp || (sensorData && sensorData.timestamp);
      const ts = rawTimestamp ? (rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp)) : null;
      if (ts && Date.now() - ts.getTime() > 15 * 60 * 1000) {
        return [];
      }
    } catch (error) {
      // ignore timestamp parsing problems, continue without failing the loop
    }

    const settings = await Settings.getSettings();
    const thresholds = (settings && settings.thresholds) || {};
    const sanitizedSensor = sanitizeSensorPayload(plainSensor, []);

    const alertsToCreate = [];
    const pushAlert = ({ type, severity, message, threshold }) => {
      const sensorSnapshot = JSON.parse(JSON.stringify(sanitizedSensor));
      alertsToCreate.push({
        type,
        severity,
        message,
        threshold: threshold || null,
        deviceId: sanitizedSensor.deviceId || null,
        sensorData: sensorSnapshot,
        createdAt: new Date(),
        status: 'new',
      });
    };

    const temperatureThresholds = thresholds.temperature || {};
    if (typeof plainSensor.temperature === 'number') {
      const { warning, critical } = temperatureThresholds;
      if (typeof critical === 'number' && plainSensor.temperature > critical) {
        pushAlert({
          type: 'temperature',
          severity: 'critical',
          message: `Critical temperature: ${plainSensor.temperature}°C (threshold: ${critical}°C)`,
          threshold: { value: critical, operator: '>' },
        });
      } else if (typeof warning === 'number' && plainSensor.temperature > warning) {
        pushAlert({
          type: 'temperature',
          severity: 'high',
          message: `High temperature: ${plainSensor.temperature}°C (threshold: ${warning}°C)`,
          threshold: { value: warning, operator: '>' },
        });
      }
    }

    const humidityThresholds = thresholds.humidity || {};
    if (typeof plainSensor.humidity === 'number') {
      const { warning, critical } = humidityThresholds;
      if (typeof critical === 'number' && plainSensor.humidity > critical) {
        pushAlert({
          type: 'humidity',
          severity: 'critical',
          message: `Critical humidity: ${plainSensor.humidity}% (threshold: ${critical}%)`,
          threshold: { value: critical, operator: '>' },
        });
      } else if (typeof warning === 'number' && plainSensor.humidity > warning) {
        pushAlert({
          type: 'humidity',
          severity: 'high',
          message: `High humidity: ${plainSensor.humidity}% (threshold: ${warning}%)`,
          threshold: { value: warning, operator: '>' },
        });
      }
    }

    const moistureThresholds = thresholds.moisture || {};
    if (typeof plainSensor.moisture === 'number') {
      const { warning, critical } = moistureThresholds;
      if (typeof critical === 'number' && plainSensor.moisture < critical) {
        pushAlert({
          type: 'moisture',
          severity: 'critical',
          message: `Critical low moisture: ${plainSensor.moisture}% (threshold: ${critical}%)`,
          threshold: { value: critical, operator: '<' },
        });
      } else if (typeof warning === 'number' && plainSensor.moisture < warning) {
        pushAlert({
          type: 'moisture',
          severity: 'medium',
          message: `Low moisture: ${plainSensor.moisture}% (threshold: ${warning}%)`,
          threshold: { value: warning, operator: '<' },
        });
      }
    }

    const phThresholds = thresholds.ph || {};
    if (typeof plainSensor.ph === 'number') {
      const { minCritical, maxCritical, minWarning, maxWarning } = phThresholds;
      if ((typeof minCritical === 'number' && plainSensor.ph < minCritical) ||
        (typeof maxCritical === 'number' && plainSensor.ph > maxCritical)) {
        pushAlert({
          type: 'ph',
          severity: 'critical',
          message: `Critical pH level: ${plainSensor.ph} (threshold: ${minCritical}-${maxCritical})`,
          threshold: { value: [minCritical, maxCritical], operator: 'outside' },
        });
      } else if ((typeof minWarning === 'number' && plainSensor.ph < minWarning) ||
        (typeof maxWarning === 'number' && plainSensor.ph > maxWarning)) {
        pushAlert({
          type: 'ph',
          severity: 'high',
          message: `Warning pH level: ${plainSensor.ph} (threshold: ${minWarning}-${maxWarning})`,
          threshold: { value: [minWarning, maxWarning], operator: 'outside' },
        });
      }
    }

    const ecThresholds = thresholds.ec || {};
    if (typeof plainSensor.ec === 'number') {
      const { warning, critical } = ecThresholds;
      if (typeof critical === 'number' && plainSensor.ec > critical) {
        pushAlert({
          type: 'ec',
          severity: 'critical',
          message: `Critical EC level: ${plainSensor.ec} mS/cm (threshold: ${critical} mS/cm)`,
          threshold: { value: critical, operator: '>' },
        });
      } else if (typeof warning === 'number' && plainSensor.ec > warning) {
        pushAlert({
          type: 'ec',
          severity: 'high',
          message: `High EC level: ${plainSensor.ec} mS/cm (threshold: ${warning} mS/cm)`,
          threshold: { value: warning, operator: '>' },
        });
      }
    }

    const nitrogenThresholds = thresholds.nitrogen || {};
    if (typeof plainSensor.nitrogen === 'number') {
      const { minWarning, minCritical } = nitrogenThresholds;
      if (typeof minCritical === 'number' && plainSensor.nitrogen < minCritical) {
        pushAlert({
          type: 'nitrogen',
          severity: 'critical',
          message: `Critical low nitrogen: ${plainSensor.nitrogen} mg/kg (threshold: ${minCritical} mg/kg)`,
          threshold: { value: minCritical, operator: '<' },
        });
      } else if (typeof minWarning === 'number' && plainSensor.nitrogen < minWarning) {
        pushAlert({
          type: 'nitrogen',
          severity: 'medium',
          message: `Low nitrogen: ${plainSensor.nitrogen} mg/kg (threshold: ${minWarning} mg/kg)`,
          threshold: { value: minWarning, operator: '<' },
        });
      }
    }

    const phosphorusThresholds = thresholds.phosphorus || {};
    if (typeof plainSensor.phosphorus === 'number') {
      const { minWarning, minCritical } = phosphorusThresholds;
      if (typeof minCritical === 'number' && plainSensor.phosphorus < minCritical) {
        pushAlert({
          type: 'phosphorus',
          severity: 'critical',
          message: `Critical low phosphorus: ${plainSensor.phosphorus} mg/kg (threshold: ${minCritical} mg/kg)`,
          threshold: { value: minCritical, operator: '<' },
        });
      } else if (typeof minWarning === 'number' && plainSensor.phosphorus < minWarning) {
        pushAlert({
          type: 'phosphorus',
          severity: 'medium',
          message: `Low phosphorus: ${plainSensor.phosphorus} mg/kg (threshold: ${minWarning} mg/kg)`,
          threshold: { value: minWarning, operator: '<' },
        });
      }
    }

    const potassiumThresholds = thresholds.potassium || {};
    if (typeof plainSensor.potassium === 'number') {
      const { minWarning, minCritical } = potassiumThresholds;
      if (typeof minCritical === 'number' && plainSensor.potassium < minCritical) {
        pushAlert({
          type: 'potassium',
          severity: 'critical',
          message: `Critical low potassium: ${plainSensor.potassium} mg/kg (threshold: ${minCritical} mg/kg)`,
          threshold: { value: minCritical, operator: '<' },
        });
      } else if (typeof minWarning === 'number' && plainSensor.potassium < minWarning) {
        pushAlert({
          type: 'potassium',
          severity: 'medium',
          message: `Low potassium: ${plainSensor.potassium} mg/kg (threshold: ${minWarning} mg/kg)`,
          threshold: { value: minWarning, operator: '<' },
        });
      }
    }

    const waterLevelThresholds = thresholds.waterLevel || {};
    if (plainSensor.waterLevel !== undefined) {
      const { critical } = waterLevelThresholds;
      if (critical !== undefined && plainSensor.waterLevel === critical) {
        pushAlert({
          type: 'water_level',
          severity: 'critical',
          message: 'Critical water level: No water detected',
          threshold: { value: critical, operator: '==' },
        });
      }
    }

    const batteryThresholds = thresholds.batteryLevel || {};
    if (typeof plainSensor.batteryLevel === 'number') {
      const { warning, critical } = batteryThresholds;
      if (typeof critical === 'number' && plainSensor.batteryLevel < critical) {
        pushAlert({
          type: 'battery_low',
          severity: 'critical',
          message: `Critical battery level: ${plainSensor.batteryLevel}% (threshold: ${critical}%)`,
          threshold: { value: critical, operator: '<' },
        });
      } else if (typeof warning === 'number' && plainSensor.batteryLevel < warning) {
        pushAlert({
          type: 'battery_low',
          severity: 'medium',
          message: `Low battery level: ${plainSensor.batteryLevel}% (threshold: ${warning}%)`,
          threshold: { value: warning, operator: '<' },
        });
      }
    }

    if (alertsToCreate.length === 0) {
      return [];
    }

    const persistedAlerts = [];
    // Debounce / dedupe: avoid creating duplicate unresolved alerts repeatedly
    const debounceMs = (() => {
      try {
        const env = parseInt(process.env.ALERT_DEBOUNCE_MS || process.env.ALERT_DEBOUNCE || '', 10);
        if (!Number.isNaN(env) && env > 0) return env;
      } catch (e) {}
      try {
        const s = settings && settings.alerts && settings.alerts.debounceMs;
        if (typeof s === 'number' && s > 0) return s;
      } catch (e) {}
      return 5 * 60 * 1000; // default 5 minutes
    })();

    for (const alertData of alertsToCreate) {
      try {
        const where = { type: alertData.type };
        if (alertData.deviceId) where.deviceId = alertData.deviceId;
        // look for a recent unresolved alert of same type/device
        const recent = await Alert.findOne({ where: { ...where, isResolved: false }, order: [['createdAt', 'DESC']] });
        if (recent) {
          const createdAt = recent.createdAt ? new Date(recent.createdAt).getTime() : null;
          if (createdAt && (Date.now() - createdAt) < debounceMs) {
            // Skip creating a duplicate alert; optionally update message/updatedAt
            continue;
          }
        }

        const created = await Alert.createAlert(alertData);
        const createdPlain = toPlainObject(created) || {};
        persistedAlerts.push(
          sanitizeAlertPayload({
            ...alertData,
            ...createdPlain,
            sensorData: alertData.sensorData,
          }),
        );
      } catch (e) {
        logger && logger.warn && logger.warn('Failed to persist alert (continuing):', e && e.message ? e.message : e);
      }
    }

    const first = persistedAlerts[0] || {};
    const devId = first.deviceId || sanitizedSensor.deviceId || plainSensor.deviceId || null;
    if (persistedAlerts.length > 0) {
      emitRealtime(REALTIME_EVENTS.ALERT_NEW, {
        deviceId: devId,
        alerts: persistedAlerts,
        event: 'new',
        triggeredAt: new Date().toISOString(),
      }, { io: ioInstance || global.io });
    }

    return persistedAlerts;
  } catch (error) {
    console.error('Error checking thresholds:', error);
    return [];
  }
};

module.exports = {
  resolveIo,
  broadcastSensorData,
  checkThresholds,
};