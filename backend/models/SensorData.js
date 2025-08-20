const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  temperature: {
    type: Number,
    required: true,
    min: -50,
    max: 100
  },
  humidity: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  moisture: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['normal', 'warning', 'critical'],
    default: 'normal'
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  signalStrength: {
    type: Number,
    min: -120,
    max: 0
  },
  isOfflineData: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
sensorDataSchema.index({ timestamp: -1 });
sensorDataSchema.index({ deviceId: 1, timestamp: -1 });
sensorDataSchema.index({ status: 1, timestamp: -1 });

// Virtual for formatted timestamp
sensorDataSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Method to determine alert level
sensorDataSchema.methods.getAlertLevel = function(thresholds) {
  if (this.temperature > thresholds.temperature.critical ||
      this.humidity > thresholds.humidity.critical ||
      this.moisture < thresholds.moisture.critical) {
    return 'critical';
  }
  
  if (this.temperature > thresholds.temperature.warning ||
      this.humidity > thresholds.humidity.warning ||
      this.moisture < thresholds.moisture.warning) {
    return 'warning';
  }
  
  return 'normal';
};

module.exports = mongoose.model('SensorData', sensorDataSchema);
