const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, adminOnly } = require('../middleware/auth');
const ActuatorLog = require('../models/ActuatorLog');
const {
  ensureDefaultActuators,
  listActuators,
  findActuatorById,
  updateActuatorStatus,
  updateActuatorMode,
  runAutomaticControl,
  sanitizeActuator,
} = require('../services/actuatorService');

ensureDefaultActuators().catch((error) => {
  console.warn('actuators: failed to ensure default records', error && error.message ? error.message : error);
});

const ALLOWED_ACTUATOR_TYPES = ['pump', 'solenoid'];
const ALLOWED_ACTIONS = ['on', 'off'];

function respondValidationErrors(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  return null;
}

router.get('/', [auth, adminOnly], async (req, res) => {
  try {
    const actuators = await listActuators();
    res.json({ success: true, data: actuators });
  } catch (error) {
    console.error('actuators: list failed', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post(
  '/control',
  [
    auth,
    adminOnly,
  body('actuatorType').isString().trim().toLowerCase().isIn(ALLOWED_ACTUATOR_TYPES).withMessage('Actuator type must be pump or solenoid'),
  body('action').isString().trim().toLowerCase().isIn(ALLOWED_ACTIONS).withMessage('Action must be on or off'),
  body('deviceId').optional().isString().trim().notEmpty().withMessage('deviceId must be a non-empty string'),
    body('reason').optional().isString().isLength({ max: 255 }).withMessage('reason must be a string up to 255 characters'),
  ],
  async (req, res) => {
    try {
      if (respondValidationErrors(req, res)) {
        return;
      }

      const { actuatorType, action, deviceId, reason } = req.body;
      const availableActuators = await listActuators();
      const target = availableActuators.find((item) => item.type === actuatorType);

      if (!target) {
        return res.status(404).json({ success: false, message: 'Actuator not found' });
      }

      const actuator = await findActuatorById(target.id);
      if (!actuator) {
        return res.status(404).json({ success: false, message: 'Actuator not found' });
      }

      const controlOptions = {
        deviceId: deviceId || 'system',
        reason: reason || null,
        triggeredBy: 'manual',
        userId: req.user && req.user.id ? req.user.id : null,
        skipLog: true,
      };

      const desiredStatus = action === 'on';
      const result = await updateActuatorStatus(actuator, desiredStatus, controlOptions);

      if (result.error) {
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
            deviceId: controlOptions.deviceId,
            actuatorType,
            action,
            reason: controlOptions.reason,
            triggeredBy: 'manual',
            userId: controlOptions.userId,
          });
        }
      } catch (logError) {
        console.warn('actuators: manual control log failed', logError && logError.message ? logError.message : logError);
      }

      const responseMessage = `${actuatorType} turned ${action} successfully`;

      return res.json({
        success: true,
        changed: result.changed,
        message: responseMessage,
        data: sanitizeActuator(result.actuator),
      });
    } catch (error) {
      console.error('actuators: control failed', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

router.post('/:id/toggle', [auth, adminOnly], async (req, res) => {
  try {
    const actuator = await findActuatorById(req.params.id);
    if (!actuator) {
      return res.status(404).json({ success: false, message: 'Actuator not found' });
    }

    if (actuator.mode !== 'manual') {
      return res.status(409).json({ success: false, message: 'Actuator is in automatic mode' });
    }

    const result = await updateActuatorStatus(actuator, !actuator.status, {
      triggeredBy: 'manual',
      userId: req.user && req.user.id,
      reason: `Manual toggle requested by ${req.user && req.user.username ? req.user.username : 'admin dashboard'}`,
    });

    if (result.error) {
      return res.status(502).json({
        success: false,
        message: result.error,
        data: sanitizeActuator(result.actuator),
        code: 'esp_unreachable',
      });
    }

    res.json({
      success: true,
      changed: result.changed,
      data: sanitizeActuator(result.actuator),
    });
  } catch (error) {
    console.error('actuators: toggle failed', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post(
  '/:id/mode',
  [auth, adminOnly, body('mode').isIn(['manual', 'auto']).withMessage('Mode must be manual or auto')],
  async (req, res) => {
    try {
      if (respondValidationErrors(req, res)) {
        return;
      }

      const actuator = await findActuatorById(req.params.id);
      if (!actuator) {
        return res.status(404).json({ success: false, message: 'Actuator not found' });
      }

      const requestedMode = req.body.mode;
      const result = await updateActuatorMode(actuator, requestedMode, {
        triggeredBy: 'manual',
        userId: req.user && req.user.id,
        reason: `Mode set to ${requestedMode} by ${req.user && req.user.username ? req.user.username : 'admin dashboard'}`,
      });

      if (result.error) {
        return res.status(502).json({
          success: false,
          message: result.error,
          data: sanitizeActuator(result.actuator),
          code: 'esp_unreachable',
        });
      }

      if (requestedMode === 'auto') {
        // Re-run automatic control immediately to align states with latest readings.
        runAutomaticControl({ source: 'mode-switch' }).catch((error) => {
          console.warn('actuators: auto-control sync failed after mode switch', error && error.message ? error.message : error);
        });
      }

      res.json({
        success: true,
        changed: result.changed,
        data: sanitizeActuator(result.actuator),
      });
    } catch (error) {
      console.error('actuators: mode update failed', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

router.post('/auto-control', [auth, adminOnly], async (req, res) => {
  try {
    const result = await runAutomaticControl({ source: 'api' });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('actuators: auto-control endpoint failed', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/logs', [auth, adminOnly], async (req, res) => {
  try {
    const { page = 1, limit = 50, deviceId, actuatorType } = req.query;
    const paginationLimit = Number(limit) || 50;
    const offset = (Number(page) - 1) * paginationLimit;

    const where = {};
    if (deviceId) where.deviceId = deviceId;
    if (actuatorType) where.actuatorType = actuatorType;

    const logs = await ActuatorLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: paginationLimit,
      offset,
    });

    res.json({
      success: true,
      logs: logs.rows,
      pagination: {
        total: logs.count,
        page: Number(page) || 1,
        pages: Math.ceil(logs.count / paginationLimit) || 1,
      },
    });
  } catch (error) {
    console.error('actuators: logs fetch failed', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
