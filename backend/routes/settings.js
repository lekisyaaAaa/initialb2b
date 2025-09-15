const express = require('express');
const { body, validationResult } = require('express-validator');
const Settings = require('../models/Settings');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/settings
// @desc    Get current settings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    // If user is not admin, hide sensitive SMS settings
    if (req.user.role !== 'admin') {
      const publicSettings = {
        thresholds: settings.thresholds,
        monitoring: {
          dataCollectionInterval: settings.monitoring.dataCollectionInterval,
          dataRetentionDays: settings.monitoring.dataRetentionDays
        },
        system: {
          timezone: settings.system.timezone
        }
      };
      
      return res.json({
        success: true,
        data: publicSettings
      });
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching settings'
    });
  }
});

// @route   PUT /api/settings/thresholds
// @desc    Update alert thresholds
// @access  Private (Admin only)
router.put('/thresholds', [auth, adminOnly], [
  body('temperature.warning').optional().isFloat({ min: -50, max: 100 }).withMessage('Temperature warning must be between -50 and 100'),
  body('temperature.critical').optional().isFloat({ min: -50, max: 100 }).withMessage('Temperature critical must be between -50 and 100'),
  body('humidity.warning').optional().isFloat({ min: 0, max: 100 }).withMessage('Humidity warning must be between 0 and 100'),
  body('humidity.critical').optional().isFloat({ min: 0, max: 100 }).withMessage('Humidity critical must be between 0 and 100'),
  body('moisture.warning').optional().isFloat({ min: 0, max: 100 }).withMessage('Moisture warning must be between 0 and 100'),
  body('moisture.critical').optional().isFloat({ min: 0, max: 100 }).withMessage('Moisture critical must be between 0 and 100'),
  body('batteryLevel.warning').optional().isFloat({ min: 0, max: 100 }).withMessage('Battery warning must be between 0 and 100'),
  body('batteryLevel.critical').optional().isFloat({ min: 0, max: 100 }).withMessage('Battery critical must be between 0 and 100'),
  body('ph.minWarning').optional().isFloat({ min: 0, max: 14 }).withMessage('pH min warning must be between 0 and 14'),
  body('ph.minCritical').optional().isFloat({ min: 0, max: 14 }).withMessage('pH min critical must be between 0 and 14'),
  body('ph.maxWarning').optional().isFloat({ min: 0, max: 14 }).withMessage('pH max warning must be between 0 and 14'),
  body('ph.maxCritical').optional().isFloat({ min: 0, max: 14 }).withMessage('pH max critical must be between 0 and 14'),
  body('ec.warning').optional().isFloat({ min: 0 }).withMessage('EC warning must be positive'),
  body('ec.critical').optional().isFloat({ min: 0 }).withMessage('EC critical must be positive'),
  body('nitrogen.minWarning').optional().isFloat({ min: 0 }).withMessage('Nitrogen min warning must be positive'),
  body('nitrogen.minCritical').optional().isFloat({ min: 0 }).withMessage('Nitrogen min critical must be positive'),
  body('phosphorus.minWarning').optional().isFloat({ min: 0 }).withMessage('Phosphorus min warning must be positive'),
  body('phosphorus.minCritical').optional().isFloat({ min: 0 }).withMessage('Phosphorus min critical must be positive'),
  body('potassium.minWarning').optional().isFloat({ min: 0 }).withMessage('Potassium min warning must be positive'),
  body('potassium.minCritical').optional().isFloat({ min: 0 }).withMessage('Potassium min critical must be positive'),
  body('waterLevel.critical').optional().isInt({ min: 0, max: 1 }).withMessage('Water level critical must be 0 or 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const settings = await Settings.getSettings();
    
    // Update thresholds with provided values
    const newThresholds = { ...settings.thresholds.toObject() };
    
    if (req.body.temperature) {
      newThresholds.temperature = { ...newThresholds.temperature, ...req.body.temperature };
    }
    if (req.body.humidity) {
      newThresholds.humidity = { ...newThresholds.humidity, ...req.body.humidity };
    }
    if (req.body.moisture) {
      newThresholds.moisture = { ...newThresholds.moisture, ...req.body.moisture };
    }
    if (req.body.batteryLevel) {
      newThresholds.batteryLevel = { ...newThresholds.batteryLevel, ...req.body.batteryLevel };
    }
    if (req.body.ph) {
      newThresholds.ph = { ...newThresholds.ph, ...req.body.ph };
    }
    if (req.body.ec) {
      newThresholds.ec = { ...newThresholds.ec, ...req.body.ec };
    }
    if (req.body.nitrogen) {
      newThresholds.nitrogen = { ...newThresholds.nitrogen, ...req.body.nitrogen };
    }
    if (req.body.phosphorus) {
      newThresholds.phosphorus = { ...newThresholds.phosphorus, ...req.body.phosphorus };
    }
    if (req.body.potassium) {
      newThresholds.potassium = { ...newThresholds.potassium, ...req.body.potassium };
    }
    if (req.body.waterLevel) {
      newThresholds.waterLevel = { ...newThresholds.waterLevel, ...req.body.waterLevel };
    }

    // Validate that critical thresholds are more restrictive than warning thresholds
    const validationErrors = [];
    
    if (newThresholds.temperature.critical <= newThresholds.temperature.warning) {
      validationErrors.push('Temperature critical threshold must be higher than warning threshold');
    }
    if (newThresholds.humidity.critical <= newThresholds.humidity.warning) {
      validationErrors.push('Humidity critical threshold must be higher than warning threshold');
    }
    if (newThresholds.moisture.critical >= newThresholds.moisture.warning) {
      validationErrors.push('Moisture critical threshold must be lower than warning threshold');
    }
    if (newThresholds.batteryLevel.critical >= newThresholds.batteryLevel.warning) {
      validationErrors.push('Battery critical threshold must be lower than warning threshold');
    }
    if (newThresholds.ph.minCritical >= newThresholds.ph.minWarning) {
      validationErrors.push('pH min critical threshold must be lower than min warning threshold');
    }
    if (newThresholds.ph.maxCritical <= newThresholds.ph.maxWarning) {
      validationErrors.push('pH max critical threshold must be higher than max warning threshold');
    }
    if (newThresholds.ec.critical <= newThresholds.ec.warning) {
      validationErrors.push('EC critical threshold must be higher than warning threshold');
    }
    if (newThresholds.nitrogen.minCritical >= newThresholds.nitrogen.minWarning) {
      validationErrors.push('Nitrogen min critical threshold must be lower than min warning threshold');
    }
    if (newThresholds.phosphorus.minCritical >= newThresholds.phosphorus.minWarning) {
      validationErrors.push('Phosphorus min critical threshold must be lower than min warning threshold');
    }
    if (newThresholds.potassium.minCritical >= newThresholds.potassium.minWarning) {
      validationErrors.push('Potassium min critical threshold must be lower than min warning threshold');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Threshold validation failed',
        errors: validationErrors
      });
    }

    settings.thresholds = newThresholds;
    await settings.save();

    res.json({
      success: true,
      message: 'Thresholds updated successfully',
      data: settings.thresholds
    });

  } catch (error) {
    console.error('Error updating thresholds:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating thresholds'
    });
  }
});

// @route   PUT /api/settings/sms
// @desc    Update SMS settings
// @access  Private (Admin only)
router.put('/sms', [auth, adminOnly], [
  body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  body('rateLimitMinutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Rate limit must be between 1 and 1440 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const settings = await Settings.getSettings();
    
    if (req.body.enabled !== undefined) {
      settings.sms.enabled = req.body.enabled;
    }
    if (req.body.rateLimitMinutes !== undefined) {
      settings.sms.rateLimitMinutes = req.body.rateLimitMinutes;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'SMS settings updated successfully',
      data: settings.sms
    });

  } catch (error) {
    console.error('Error updating SMS settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating SMS settings'
    });
  }
});

// @route   POST /api/settings/sms/phone
// @desc    Add phone number for SMS alerts
// @access  Private (Admin only)
router.post('/sms/phone', [auth, adminOnly], [
  body('name').notEmpty().withMessage('Name is required'),
  body('number').matches(/^\+[1-9]\d{1,14}$/).withMessage('Phone number must be in international format (+1234567890)')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, number } = req.body;
    const settings = await Settings.getSettings();

    // Check if phone number already exists
    const existingPhone = settings.sms.phoneNumbers.find(phone => phone.number === number);
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    await settings.addPhoneNumber(name, number);

    res.status(201).json({
      success: true,
      message: 'Phone number added successfully',
      data: settings.sms.phoneNumbers
    });

  } catch (error) {
    console.error('Error adding phone number:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding phone number'
    });
  }
});

// @route   DELETE /api/settings/sms/phone/:phoneId
// @desc    Remove phone number
// @access  Private (Admin only)
router.delete('/sms/phone/:phoneId', [auth, adminOnly], async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const phoneNumber = settings.sms.phoneNumbers.id(req.params.phoneId);
    
    if (!phoneNumber) {
      return res.status(404).json({
        success: false,
        message: 'Phone number not found'
      });
    }

    await settings.removePhoneNumber(req.params.phoneId);

    res.json({
      success: true,
      message: 'Phone number removed successfully',
      data: settings.sms.phoneNumbers
    });

  } catch (error) {
    console.error('Error removing phone number:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing phone number'
    });
  }
});

// @route   PUT /api/settings/monitoring
// @desc    Update monitoring settings
// @access  Private (Admin only)
router.put('/monitoring', [auth, adminOnly], [
  body('dataCollectionInterval').optional().isInt({ min: 10, max: 3600 }).withMessage('Data collection interval must be between 10 and 3600 seconds'),
  body('offlineTimeoutMinutes').optional().isInt({ min: 1, max: 60 }).withMessage('Offline timeout must be between 1 and 60 minutes'),
  body('dataRetentionDays').optional().isInt({ min: 1, max: 365 }).withMessage('Data retention must be between 1 and 365 days')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const settings = await Settings.getSettings();
    
    if (req.body.dataCollectionInterval !== undefined) {
      settings.monitoring.dataCollectionInterval = req.body.dataCollectionInterval;
    }
    if (req.body.offlineTimeoutMinutes !== undefined) {
      settings.monitoring.offlineTimeoutMinutes = req.body.offlineTimeoutMinutes;
    }
    if (req.body.dataRetentionDays !== undefined) {
      settings.monitoring.dataRetentionDays = req.body.dataRetentionDays;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Monitoring settings updated successfully',
      data: settings.monitoring
    });

  } catch (error) {
    console.error('Error updating monitoring settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating monitoring settings'
    });
  }
});

// @route   PUT /api/settings/system
// @desc    Update system settings
// @access  Private (Admin only)
router.put('/system', [auth, adminOnly], [
  body('timezone').optional().notEmpty().withMessage('Timezone cannot be empty'),
  body('autoResolveAlerts').optional().isBoolean().withMessage('Auto resolve alerts must be a boolean'),
  body('autoResolveTimeMinutes').optional().isInt({ min: 5, max: 1440 }).withMessage('Auto resolve time must be between 5 and 1440 minutes')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const settings = await Settings.getSettings();
    
    if (req.body.timezone !== undefined) {
      settings.system.timezone = req.body.timezone;
    }
    if (req.body.autoResolveAlerts !== undefined) {
      settings.system.autoResolveAlerts = req.body.autoResolveAlerts;
    }
    if (req.body.autoResolveTimeMinutes !== undefined) {
      settings.system.autoResolveTimeMinutes = req.body.autoResolveTimeMinutes;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'System settings updated successfully',
      data: settings.system
    });

  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating system settings'
    });
  }
});

// @route   POST /api/settings/reset
// @desc    Reset settings to default
// @access  Private (Admin only)
router.post('/reset', [auth, adminOnly], async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    // Reset to default values
    const defaultSettings = new Settings({});
    
    settings.thresholds = defaultSettings.thresholds;
    settings.monitoring = defaultSettings.monitoring;
    settings.system = defaultSettings.system;
    
    // Keep SMS settings as they contain user data
    
    await settings.save();

    res.json({
      success: true,
      message: 'Settings reset to default values',
      data: settings
    });

  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting settings'
    });
  }
});

module.exports = router;
