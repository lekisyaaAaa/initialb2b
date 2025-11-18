const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Settings = sequelize.define('Settings', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  value: {
    // Use TEXT for the settings value because we store JSON blobs which frequently exceed 255 chars
    // and may contain nested keys (thresholds, monitoring, etc.). TEXT prevents insertion errors
    // like "value too long for type character varying(255)" seen in production.
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'settings',
  timestamps: false,
  underscored: true,
});

const DEFAULT_THRESHOLDS = {
  temperature: {
    min: 20,
    max: 30,
    warning: 32,
    critical: 35,
    lowWarning: 18,
    lowCritical: 15,
  },
  humidity: {
    min: 55,
    max: 70,
    warning: 75,
    lowWarning: 45,
  },
  moisture: { min: 30, max: 60, warning: 35, critical: 25 },
  batteryLevel: { min: 0, max: 100, warning: 20, critical: 10 },
  ph: {
    idealMin: 6.2,
    idealMax: 7.0,
    minWarning: 6.0,
    minCritical: 5.5,
    maxWarning: 7.5,
    maxCritical: 8.0,
  },
  ec: {
    min: 0.8,
    max: 2.0,
    warning: 2.2,
    critical: 2.5,
    lowWarning: 0.5,
  },
  nitrogen: {
    minWarning: 150,
    minCritical: 100,
    maxWarning: 600,
  },
  phosphorus: {
    minWarning: 20,
    minCritical: 10,
    maxWarning: 100,
  },
  potassium: {
    minWarning: 100,
    minCritical: 50,
    maxWarning: 350,
  },
  waterLevel: { critical: 0 },
  floatSensor: {
    normalState: 1,
    lowAlertState: 0,
    lowAlertDurationSec: 90,
  },
  waterPump: {
    maxRuntimeSec: 300,
    minRestSec: 120,
    minFlowLpm: 2,
  },
};

const DEFAULT_MONITORING = {
  dataCollectionInterval: 30,
  dataRetentionDays: 30,
  offlineTimeoutMinutes: 10,
};

const DEFAULT_SYSTEM = {
  timezone: 'UTC',
};

const DEFAULT_VERMITEA = {
  tankAreaLitersPerUnit: 0.5,
};

const DEFAULT_ALERT_RULES = {
  temperature: true,
  humidity: true,
  moisture: true,
  ph: true,
  system: true,
  emailNotifications: false,
};

function mergeThresholdMetric(defaultMetric, currentMetric) {
  if (!defaultMetric) {
    return { ...(currentMetric || {}) };
  }
  return {
    ...defaultMetric,
    ...(currentMetric || {}),
  };
}

function normalizeThresholds(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const merged = { ...DEFAULT_THRESHOLDS };

  Object.keys(DEFAULT_THRESHOLDS).forEach((key) => {
    merged[key] = mergeThresholdMetric(DEFAULT_THRESHOLDS[key], source[key]);
  });

  // Ensure legacy payloads that stored arrays or invalid types do not break consumers.
  return merged;
}

// Static method to get all settings as a structured object
Settings.getSettings = async () => {
  try {
    const settings = await Settings.findAll();
    const settingsObj = {};

    settings.forEach(setting => {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch (e) {
        settingsObj[setting.key] = setting.value;
      }
    });

    settingsObj.thresholds = normalizeThresholds(settingsObj.thresholds);

    if (!settingsObj.monitoring) {
      settingsObj.monitoring = { ...DEFAULT_MONITORING };
    } else {
      settingsObj.monitoring = {
        ...DEFAULT_MONITORING,
        ...(settingsObj.monitoring || {}),
      };
    }

    if (!settingsObj.system) {
      settingsObj.system = { ...DEFAULT_SYSTEM };
    } else {
      settingsObj.system = {
        ...DEFAULT_SYSTEM,
        ...(settingsObj.system || {}),
      };
    }

    if (!settingsObj.vermitea) {
      settingsObj.vermitea = { ...DEFAULT_VERMITEA };
    } else {
      settingsObj.vermitea = {
        ...DEFAULT_VERMITEA,
        ...(settingsObj.vermitea || {}),
      };
    }

    if (!settingsObj.alerts) {
      settingsObj.alerts = { ...DEFAULT_ALERT_RULES };
    } else {
      settingsObj.alerts = {
        ...DEFAULT_ALERT_RULES,
        ...(settingsObj.alerts || {}),
      };
    }

    return settingsObj;
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

Settings.DEFAULT_ALERT_RULES = DEFAULT_ALERT_RULES;
Settings.DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS;

module.exports = Settings;
