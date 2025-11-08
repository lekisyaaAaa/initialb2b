const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminOnly } = require('../middleware/auth');
const ActuatorLog = require('../models/ActuatorLog');
const {
  listActuators,
  findActuatorById,
  updateActuatorStatus,
  sanitizeActuator,
} = require('../services/actuatorService');

const router = express.Router();

const respondValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
    return true;
  }
  return false;
};

const baseValidators = [
  body('actuatorId').optional().isInt({ min: 1 }).withMessage('actuatorId must be a positive integer'),
  body('actuatorType').optional().isString().trim().isLength({ min: 1 }).withMessage('actuatorType must be a non-empty string'),
  body('action')
    .isString()
    .trim()
    .isIn(['on', 'off', 'true', 'false', 'enable', 'disable'])
    .withMessage('action must be one of on/off/true/false/enable/disable'),
  body('deviceId').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('deviceId must be a non-empty string'),
  body('reason').optional().isString().isLength({ max: 255 }).withMessage('reason must be at most 255 characters'),
];

const resolveDesiredState = (action) => {
  const normalized = String(action).toLowerCase();
  if (['on', 'true', 'enable', '1'].includes(normalized)) {
    return true;
  }
  if (['off', 'false', 'disable', '0'].includes(normalized)) {
    return false;
  }
  return null;
};

router.post('/control', [auth, adminOnly, ...baseValidators], async (req, res) => {
  if (respondValidationErrors(req, res)) {
    return;
  }

  const { actuatorId, actuatorType, action, deviceId, reason } = req.body;
  const desiredState = resolveDesiredState(action);

  if (desiredState === null) {
    return res.status(400).json({ success: false, message: 'Invalid action supplied' });
  }

  try {
    let target = null;
    if (actuatorId !== undefined && actuatorId !== null) {
      target = await findActuatorById(actuatorId);
    }

    if (!target) {
      const available = await listActuators();
      if (actuatorType) {
        const typeLower = actuatorType.toLowerCase();
        target = available.find((item) => {
          if (item.id === actuatorId) return true;
          const normalizedName = (item.name || '').toLowerCase();
          const normalizedType = (item.type || '').toLowerCase();
          return normalizedType === typeLower || normalizedName.includes(typeLower);
        });
      } else if (available.length === 1) {
        target = available[0];
      }
    }

    if (!target) {
      return res.status(404).json({ success: false, message: 'Actuator not found' });
    }

    const actuatorRecord = await findActuatorById(target.id);
    if (!actuatorRecord) {
      return res.status(404).json({ success: false, message: 'Actuator not found' });
    }

    if (actuatorRecord.mode !== 'manual') {
      return res.status(409).json({ success: false, message: 'Actuator is not in manual mode' });
    }

    const normalizedDeviceId = typeof deviceId === 'string' && deviceId.trim().length > 0 ? deviceId.trim() : null;

    const context = {
      triggeredBy: 'manual',
      userId: req.user && req.user.id ? req.user.id : null,
      deviceId: normalizedDeviceId,
      reason: reason || `Manual ${desiredState ? 'enable' : 'disable'} via /api/actuator/control`,
    };

    const result = await updateActuatorStatus(actuatorRecord, desiredState, context);

    if (result.error) {
      if (result.statusCode === 423) {
        return res.status(423).json({
          success: false,
          message: result.error,
          code: 'float_lockout',
          data: {
            actuator: sanitizeActuator(result.actuator),
            floatSensor: typeof result.floatSensor === 'number' ? result.floatSensor : null,
            floatSensorTimestamp: result.floatSensorTimestamp || null,
          },
        });
      }
      return res.status(502).json({
        success: false,
        message: result.error,
        data: sanitizeActuator(result.actuator),
        code: 'esp_unreachable',
      });
    }

    try {
      if (typeof ActuatorLog.create === 'function') {
        await ActuatorLog.create({
          deviceId: context.deviceId || 'system',
          actuatorType: sanitizeActuator(actuatorRecord).type,
          action: desiredState ? 'on' : 'off',
          reason: context.reason,
          triggeredBy: 'manual',
          userId: context.userId,
        });
      }
    } catch (logError) {
      console.warn('actuator-control: failed to log control event', logError && logError.message ? logError.message : logError);
    }

    const payload = sanitizeActuator(result.actuator);
    res.json({
      success: true,
      changed: result.changed,
      data: payload,
    });
  } catch (error) {
    console.error('actuator-control: command failed', error);
    res.status(500).json({ success: false, message: 'Failed to execute actuator command' });
  }
});

module.exports = router;
