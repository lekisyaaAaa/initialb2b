const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['temperature', 'humidity', 'moisture', 'device_offline', 'device_online', 'battery_low']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  message: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  sensorData: {
    temperature: Number,
    humidity: Number,
    moisture: Number,
    batteryLevel: Number
  },
  threshold: {
    value: Number,
    operator: {
      type: String,
      enum: ['>', '<', '>=', '<=', '=='],
      default: '>'
    }
  },
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  notificationSentAt: {
    type: Date
  },
  acknowledgedBy: {
    type: String // User who acknowledged the alert
  },
  acknowledgedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
alertSchema.index({ createdAt: -1 });
alertSchema.index({ deviceId: 1, createdAt: -1 });
alertSchema.index({ type: 1, createdAt: -1 });
alertSchema.index({ severity: 1, createdAt: -1 });
alertSchema.index({ isResolved: 1, createdAt: -1 });

// Virtual for formatted timestamp
alertSchema.virtual('formattedTimestamp').get(function() {
  return this.createdAt.toISOString();
});

// Method to resolve alert
alertSchema.methods.resolve = function(resolvedBy) {
  this.isResolved = true;
  this.resolvedAt = new Date();
  this.acknowledgedBy = resolvedBy;
  this.acknowledgedAt = new Date();
  return this.save();
};

// Static method to create alert
alertSchema.statics.createAlert = async function(alertData) {
  const alert = new this(alertData);
  return await alert.save();
};

// Static method to get unresolved alerts
alertSchema.statics.getUnresolvedAlerts = function(deviceId = null) {
  const query = { isResolved: false };
  if (deviceId) {
    query.deviceId = deviceId;
  }
  return this.find(query).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Alert', alertSchema);
