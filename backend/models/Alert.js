const { DataTypes } = require('sequelize');
const sequelize = require('../services/database_pg');

const Alert = sequelize.define('Alert', {
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  severity: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sensorData: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  isResolved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  acknowledgedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('new', 'read'),
    allowNull: false,
    defaultValue: 'new',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'alerts',
  timestamps: false,
});

// Static helper to create an alert with a consistent shape
Alert.createAlert = async function (alertData) {
  const data = {
    type: alertData.type,
    severity: alertData.severity || null,
    message: alertData.message || '',
    deviceId: alertData.deviceId || null,
    sensorData: alertData.sensorData || null,
    isResolved: !!alertData.isResolved,
    resolvedAt: alertData.resolvedAt || null,
    acknowledgedBy: alertData.acknowledgedBy || null,
    acknowledgedAt: alertData.acknowledgedAt || null,
    status: alertData.status || 'new',
    createdAt: alertData.createdAt || new Date(),
  };
  const created = await Alert.create(data);
  return created;
};

// Instance helper to mark an alert as resolved
Alert.prototype.resolve = async function (username) {
  try {
    this.isResolved = true;
    const now = new Date();
    this.resolvedAt = now;
    this.acknowledgedBy = username || null;
    this.acknowledgedAt = now;
    // Persist changes
    await Alert.update({
      isResolved: this.isResolved,
      resolvedAt: this.resolvedAt,
      acknowledgedBy: this.acknowledgedBy,
      acknowledgedAt: this.acknowledgedAt,
      updatedAt: now
    }, { where: { id: this.id } });
    // Reload to get fresh values
    const reloaded = await Alert.findByPk(this.id);
    // copy reloaded props back onto this
    if (reloaded) {
      Object.assign(this, reloaded.get ? reloaded.get({ plain: true }) : reloaded);
    }
    return this;
  } catch (e) {
    throw e;
  }
};

module.exports = Alert;
