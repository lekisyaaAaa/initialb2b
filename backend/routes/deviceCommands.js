const express = require('express');
const { body, query, validationResult } = require('express-validator');
const deviceCommandQueue = require('../services/deviceCommandQueue');
const { markDeviceAck } = require('../services/actuatorService');

const router = express.Router();

function respondValidationErrors(req, res) {
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

function serializeCommand(command) {
  if (!command) return null;
  const plain = command.get ? command.get({ plain: true }) : command;
  return {
    id: plain.id,
    deviceId: plain.device_id,
    type: plain.command_type,
    payload: plain.payload || {},
    status: plain.status,
    requestedAt: plain.requested_at,
    dispatchedAt: plain.dispatched_at,
  };
}

router.get(
  '/next',
  [
    query('deviceId').optional().isString().trim().isLength({ min: 1, max: 120 }).withMessage('deviceId must be a non-empty string'),
  ],
  async (req, res) => {
    if (respondValidationErrors(req, res)) return;

    const { deviceId } = req.query;
    try {
      const command = await deviceCommandQueue.reserveNextCommand(deviceId);
      res.json({
        success: true,
        command: serializeCommand(command),
      });
    } catch (error) {
      console.error('deviceCommands: failed to reserve next command', error);
      res.status(500).json({ success: false, message: 'Failed to load command' });
    }
  }
);

router.post(
  '/:id/ack',
  [
    body('status')
      .isString()
      .trim()
      .isIn(['completed', 'failed', 'ok', 'error'])
      .withMessage('status must be completed, failed, ok, or error'),
    body('payload').optional().isObject().withMessage('payload must be an object'),
    body('message').optional().isString().isLength({ max: 255 }).withMessage('message must be 255 characters or fewer'),
    body('actuator').optional().isString().isLength({ min: 1, max: 120 }).withMessage('actuator must be a non-empty string'),
  ],
  async (req, res) => {
    if (respondValidationErrors(req, res)) return;

    const commandId = Number(req.params.id);
    if (!Number.isInteger(commandId) || commandId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid command id' });
    }

    const status = req.body.status;
    const success = status === 'completed' || status === 'ok';
    const payload = req.body.payload || null;
    const message = req.body.message || null;
    const actuatorName = req.body.actuator || (payload && payload.actuator) || null;

    try {
      const result = await deviceCommandQueue.handleCommandAck({ commandId, success, payload, message });
      if (!result) {
        return res.status(404).json({ success: false, message: 'Command not found' });
      }

      if (actuatorName) {
        try {
          await markDeviceAck(actuatorName, success, { message });
        } catch (ackError) {
          console.warn('deviceCommands: failed to update actuator ack state', ackError && ackError.message ? ackError.message : ackError);
        }
      }

      res.json({
        success: true,
        data: {
          command: serializeCommand(result.command),
          ack: {
            success,
            message,
          },
        },
      });
    } catch (error) {
      console.error('deviceCommands: failed to process acknowledgement', error);
      res.status(500).json({ success: false, message: 'Failed to process acknowledgement' });
    }
  }
);

module.exports = router;
