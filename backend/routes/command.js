function toLegacySolenoid(actuatorKey) {
  const meta = VALID_ACTUATORS.get(normalizeActuator(actuatorKey));
  return meta && typeof meta.solenoidIndex === 'number' ? meta.solenoidIndex : null;
}
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Command } = require('../models');
const deviceCommandQueue = require('../services/deviceCommandQueue');

const router = express.Router();

const VALID_ACTUATORS = new Map([
  ['pump', { label: 'Water Pump', solenoidIndex: null }],
  ['solenoid1', { label: 'Solenoid Valve 1', solenoidIndex: 1 }],
  ['solenoid2', { label: 'Solenoid Valve 2', solenoidIndex: 2 }],
  ['solenoid3', { label: 'Solenoid Valve 3', solenoidIndex: 3 }],
]);

const ACTUATOR_SUMMARY_KEYS = Array.from(VALID_ACTUATORS.keys());

function normalizeActuator(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function sendValidationErrors(req, res) {
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
}

function toApiPayload(command) {
  if (!command) {
    return null;
  }
  const plain = command.get ? command.get({ plain: true }) : command;
  return {
    id: plain.id,
    device_id: plain.deviceId || plain.device_id,
    actuator: plain.actuator,
    solenoid: typeof plain.solenoid !== 'undefined' ? plain.solenoid : toLegacySolenoid(plain.actuator),
    action: plain.action,
    status: plain.status,
    responseMessage: plain.responseMessage || plain.response_message || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

router.post(
  '/',
  [
    body('device_id').exists().bail().isString().trim().isLength({ min: 1, max: 120 }).withMessage('device_id is required'),
    body('actuator')
      .exists().withMessage('actuator is required')
      .bail()
      .isString().withMessage('actuator must be a string')
      .bail()
      .custom((value) => VALID_ACTUATORS.has(normalizeActuator(value)))
      .withMessage('actuator must be one of pump, solenoid1, solenoid2, solenoid3'),
    body('action').isString().trim().toLowerCase().isIn(['on', 'off']).withMessage('action must be "on" or "off"'),
  ],
  async (req, res) => {
    if (sendValidationErrors(req, res)) {
      return;
    }

    const deviceId = req.body.device_id.trim();
    const action = String(req.body.action).toLowerCase();
    const actuatorKey = normalizeActuator(req.body.actuator);

    if (!VALID_ACTUATORS.has(actuatorKey)) {
      return res.status(400).json({ success: false, message: 'Invalid actuator target' });
    }

    const actuatorMeta = VALID_ACTUATORS.get(actuatorKey);

    try {
      const command = await Command.create({
        deviceId,
        actuator: actuatorKey,
        action,
        status: 'pending',
      });

      const actuatorLabel = actuatorMeta.label;
      const desiredState = action === 'on';
      const { dispatched } = await deviceCommandQueue.queueActuatorCommand({
        hardwareId: deviceId,
        actuatorName: actuatorLabel,
        desiredState,
        context: {
          actuator: actuatorKey,
          solenoid: actuatorMeta.solenoidIndex,
          commandRowId: command.id,
          requestedBy: 'api/command',
        },
      });

      if (dispatched) {
        await command.update({ status: 'dispatched' });
      }

      const payload = toApiPayload(command);

      try {
        if (global.io) {
          const summary = {
            ...payload,
            status: dispatched ? 'dispatched' : 'pending',
          };
          global.io.emit('actuator_command_update', summary);
          global.io.emit('solenoid_command_update', summary);
          global.io.to(`device:${deviceId}`).emit('actuator_command_update', summary);
          global.io.to(`device:${deviceId}`).emit('solenoid_command_update', summary);
        }
      } catch (socketError) {
        // logging handled by queue service; keep route focused
      }

      res.status(201).json({
        success: true,
        data: {
          command: payload,
          dispatched,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to enqueue command', error: error.message });
    }
  }
);

router.get(
  '/status',
  [
    query('device_id').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('device_id must be a non-empty string'),
  ],
  async (req, res) => {
    if (sendValidationErrors(req, res)) {
      return;
    }

    const deviceId = (req.query.device_id || req.query.deviceId || '').trim() || null;

    const where = deviceId ? { deviceId } : {};

    try {
      const recentCommands = await Command.findAll({
        where,
        order: [['updatedAt', 'DESC']],
        limit: 30,
      });

      const latestByActuator = ACTUATOR_SUMMARY_KEYS.map((key) => {
        const match = recentCommands.find((row) => row.actuator === key);
        return match ? toApiPayload(match) : { actuator: key, status: 'idle' };
      });

      res.json({
        success: true,
        data: {
          commands: recentCommands.map(toApiPayload),
          latestByActuator,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to load command status', error: error.message });
    }
  }
);

module.exports = router;
