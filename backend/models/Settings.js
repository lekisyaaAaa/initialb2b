const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Alert thresholds
  thresholds: {
    temperature: {
      warning: {
        type: Number,
        default: 25,
        min: -50,
        max: 100
      },
      critical: {
        type: Number,
        default: 30,
        min: -50,
        max: 100
      }
    },
    humidity: {
      warning: {
        type: Number,
        default: 70,
        min: 0,
        max: 100
      },
      critical: {
        type: Number,
        default: 80,
        min: 0,
        max: 100
      }
    },
    moisture: {
      warning: {
        type: Number,
        default: 30,
        min: 0,
        max: 100
      },
      critical: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      }
    },
    batteryLevel: {
      warning: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      critical: {
        type: Number,
        default: 10,
        min: 0,
        max: 100
      }
    }
  },
  
  // SMS notification settings
  sms: {
    enabled: {
      type: Boolean,
      default: true
    },
    phoneNumbers: [{
      name: String,
      number: {
        type: String,
        validate: {
          validator: function(v) {
            return /^\+[1-9]\d{1,14}$/.test(v);
          },
          message: 'Phone number must be in international format (+1234567890)'
        }
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    rateLimitMinutes: {
      type: Number,
      default: 10,
      min: 1,
      max: 1440 // Max 24 hours
    }
  },
  
  // Device monitoring settings
  monitoring: {
    dataCollectionInterval: {
      type: Number,
      default: 30, // seconds
      min: 10,
      max: 3600
    },
    offlineTimeoutMinutes: {
      type: Number,
      default: 5,
      min: 1,
      max: 60
    },
    dataRetentionDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    }
  },
  
  // System settings
  system: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    autoResolveAlerts: {
      type: Boolean,
      default: false
    },
    autoResolveTimeMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 1440
    }
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.index({ _id: 1 }, { unique: true });

// Static method to get or create settings
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this({});
    await settings.save();
  }
  return settings;
};

// Method to update thresholds
settingsSchema.methods.updateThresholds = function(newThresholds) {
  this.thresholds = { ...this.thresholds.toObject(), ...newThresholds };
  return this.save();
};

// Method to add phone number
settingsSchema.methods.addPhoneNumber = function(name, number) {
  this.sms.phoneNumbers.push({ name, number, isActive: true });
  return this.save();
};

// Method to remove phone number
settingsSchema.methods.removePhoneNumber = function(phoneId) {
  this.sms.phoneNumbers.id(phoneId).remove();
  return this.save();
};

module.exports = mongoose.model('Settings', settingsSchema);
