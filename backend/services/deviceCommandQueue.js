const { Op } = require('sequelize');
const DeviceCommand = require('../models/DeviceCommand');
const { Command } = require('../models');
const Device = require('../models/Device');
const logger = require('../utils/logger');
const { markDeviceOnline } = require('./deviceManager');

const DEFAULT_DEVICE_ID = (process.env.PRIMARY_DEVICE_ID || process.env.DEFAULT_DEVICE_ID || '').trim();
const COMMAND_RETRY_INTERVAL_MS = parseInt(process.env.COMMAND_RETRY_INTERVAL_MS || '5000', 10);
const COMMAND_RETRY_STALE_MS = Math.max(
  2000,
  parseInt(process.env.COMMAND_RETRY_STALE_MS || process.env.DEVICE_OFFLINE_TIMEOUT_MS || '15000', 10),
);

function getSocketsMap() {
  if (!global.socketIoDeviceSockets || !(global.socketIoDeviceSockets instanceof Map)) {
    global.socketIoDeviceSockets = new Map();
  }
  return global.socketIoDeviceSockets;
}

function getDefaultDeviceId() {
  return DEFAULT_DEVICE_ID.length > 0 ? DEFAULT_DEVICE_ID : null;
}

function bindSocketToDevice(hardwareId, socket) {
  if (!hardwareId || !socket) {
    return;
  }
  const sockets = getSocketsMap();
  sockets.set(hardwareId, socket);
  socket.data = socket.data || {};
  socket.data.hardwareId = hardwareId;
  if (typeof socket.join === 'function') {
    socket.join(`device:${hardwareId}`);
  }
}

function removeSocketForDevice(hardwareId, socket) {
  if (!hardwareId) return;
  const sockets = getSocketsMap();
  const known = sockets.get(hardwareId);
  if (!known) return;
  if (!socket || socket === known) {
    sockets.delete(hardwareId);
  }
}

function getSocketForDevice(hardwareId) {
  if (!hardwareId) {
    return null;
  }
  const sockets = getSocketsMap();
  return sockets.get(hardwareId) || null;
}

async function resolveDeviceRecord(hardwareId) {
  if (!hardwareId) {
    const fallback = getDefaultDeviceId();
    if (!fallback) {
      return null;
    }
    hardwareId = fallback;
  }

  const trimmed = String(hardwareId).trim();
  if (!trimmed) {
    return null;
  }

  const [device] = await Device.findOrCreate({
    where: { deviceId: trimmed },
    defaults: {
      deviceId: trimmed,
      status: 'online',
      lastHeartbeat: new Date(),
    },
  });

  return device;
}

async function dispatchCommand(command, hardwareId, socketOverride = null) {
  if (!command) return false;
  const socket = socketOverride || getSocketForDevice(hardwareId);
  if (!socket) {
    return false;
  }

  try {
    const payload = {
      commandId: command.id,
      type: command.command_type,
      requestedAt: command.requested_at,
      payload: command.payload || {},
    };
    socket.emit('command:issue', payload);
    command.status = 'dispatched';
    command.dispatched_at = new Date();
    await command.save();
    if (command.payload && command.payload.commandRowId) {
      await Command.update({ status: 'dispatched' }, { where: { id: command.payload.commandRowId } });
    }
    return true;
  } catch (error) {
    logger.warn('deviceCommandQueue: failed to emit command to socket', {
      commandId: command.id,
      error: error && error.message ? error.message : error,
    });
    return false;
  }
}

async function dispatchPendingCommands(hardwareId) {
  const device = await resolveDeviceRecord(hardwareId);
  if (!device) {
    return 0;
  }

  const commands = await DeviceCommand.findAll({
    where: {
      device_id: device.id,
      status: 'pending',
    },
    order: [['requested_at', 'ASC']],
    limit: 20,
  });

  let dispatched = 0;
  for (const command of commands) {
    const sent = await dispatchCommand(command, device.deviceId);
    if (sent) {
      dispatched += 1;
    }
  }
  return dispatched;
}

async function queueActuatorCommand({ hardwareId, actuatorName, desiredState, context = {} }) {
  const device = await resolveDeviceRecord(hardwareId);
  if (!device) {
    throw new Error('Unable to resolve target device for actuator command');
  }

  const commandRowId = context.commandRowId || null;
  const actuatorKey = typeof context.actuator === 'string' ? String(context.actuator).toLowerCase() : null;
  const solenoidIndex = typeof context.solenoid === 'number' ? context.solenoid : null;

  const payload = {
    actuator: actuatorName,
    desired: desiredState ? 'on' : 'off',
    actuatorKey,
    solenoid: solenoidIndex,
    commandRowId,
    context,
  };

  const command = await DeviceCommand.create({
    device_id: device.id,
    command_type: 'actuator_toggle',
    payload,
    status: 'pending',
    requested_at: new Date(),
  });

  const dispatched = await dispatchCommand(command, device.deviceId);
  if (!dispatched) {
    logger.debug('deviceCommandQueue: queued actuator command for later dispatch', {
      commandId: command.id,
      hardwareId: device.deviceId,
    });
  }

  if (commandRowId) {
    await Command.update({ status: dispatched ? 'dispatched' : 'pending' }, { where: { id: commandRowId } });
  }

  return { command, dispatched };
}

async function markCommandPending(commandId, message) {
  if (!commandId) return null;
  const command = await DeviceCommand.findByPk(commandId);
  if (!command) return null;
  command.status = 'pending';
  command.dispatched_at = null;
  command.response_payload = message ? { error: message } : null;
  command.response_received_at = null;
  await command.save();
  if (command.payload && command.payload.commandRowId) {
    await Command.update({ status: 'pending', responseMessage: message || null }, { where: { id: command.payload.commandRowId } });
  }
  return command;
}

async function markCommandCompleted(commandId, info = {}) {
  if (!commandId) return null;
  const command = await DeviceCommand.findByPk(commandId);
  if (!command) return null;
  command.status = 'completed';
  command.response_payload = info && info.response ? info.response : info;
  command.response_received_at = new Date();
  await command.save();
  if (command.payload && command.payload.commandRowId) {
    await Command.update({ status: 'done' }, { where: { id: command.payload.commandRowId } });
  }
  return command;
}

async function handleCommandAck({ commandId, success, payload = null, message = null }) {
  if (!commandId) return null;
  const command = await DeviceCommand.findByPk(commandId);
  if (!command) return null;

  command.status = success ? 'completed' : 'failed';
  command.response_payload = payload || (message ? { message } : null);
  command.response_received_at = new Date();
  await command.save();

  let linkedCommand = null;
  if (command.payload && command.payload.commandRowId) {
    linkedCommand = await Command.findByPk(command.payload.commandRowId);
    if (linkedCommand) {
      linkedCommand.status = success ? 'done' : 'failed';
      linkedCommand.responseMessage = message || null;
      await linkedCommand.save();
    }
  }

  try {
    if (global.io) {
      const summary = {
        id: linkedCommand ? linkedCommand.id : null,
        deviceId: linkedCommand ? linkedCommand.deviceId : null,
        actuator: linkedCommand ? linkedCommand.actuator : (payload && payload.actuatorKey ? payload.actuatorKey : null),
        solenoid: payload && typeof payload.solenoid !== 'undefined' ? payload.solenoid : null,
        action: linkedCommand ? linkedCommand.action : (payload && payload.action ? payload.action : null),
        status: success ? 'done' : 'failed',
        message: message || null,
        ackReceivedAt: new Date().toISOString(),
      };
      global.io.emit('actuator_command_update', summary);
      global.io.emit('solenoid_command_update', summary);
      if (summary.deviceId) {
        global.io.to(`device:${summary.deviceId}`).emit('actuator_command_update', summary);
        global.io.to(`device:${summary.deviceId}`).emit('solenoid_command_update', summary);
      }
    }
  } catch (ioError) {
    logger.debug('deviceCommandQueue: failed to broadcast solenoid_command_update', ioError && ioError.message ? ioError.message : ioError);
  }

  return {
    command,
    success,
  };
}

async function reserveNextCommand(hardwareId) {
  const device = await resolveDeviceRecord(hardwareId);
  if (!device) {
    return null;
  }

  const command = await DeviceCommand.findOne({
    where: {
      device_id: device.id,
      status: 'pending',
    },
    order: [['requested_at', 'ASC']],
  });

  if (!command) {
    return null;
  }

  const dispatched = await dispatchCommand(command, device.deviceId);
  if (!dispatched) {
    command.status = 'dispatched';
    command.dispatched_at = new Date();
    await command.save();
  }

  return command;
}

async function retryStaleCommands() {
  const staleBefore = new Date(Date.now() - COMMAND_RETRY_STALE_MS);
  const commands = await DeviceCommand.findAll({
    where: {
      status: {
        [Op.in]: ['pending', 'dispatched'],
      },
      updatedAt: {
        [Op.lte]: staleBefore,
      },
    },
    order: [['requested_at', 'ASC']],
    limit: 25,
  });

  for (const command of commands) {
    const device = await Device.findByPk(command.device_id);
    if (!device || !device.deviceId) {
      continue;
    }
    const sent = await dispatchCommand(command, device.deviceId);
    if (!sent) {
      // Leave the command as-is; retry on next pass.
      continue;
    }
  }
}

let retryTimer = null;
function startCommandRetryLoop() {
  if (retryTimer) {
    return retryTimer;
  }

  retryTimer = setInterval(() => {
    retryStaleCommands().catch((error) => {
      logger.warn('deviceCommandQueue: retry loop error', error && error.message ? error.message : error);
    });
  }, COMMAND_RETRY_INTERVAL_MS);

  if (typeof retryTimer.unref === 'function') {
    retryTimer.unref();
  }

  return retryTimer;
}

async function registerSocket(hardwareId, socket, metadata = {}) {
  if (!hardwareId || !socket) {
    return;
  }
  const trimmed = String(hardwareId).trim();
  if (!trimmed) {
    return;
  }

  bindSocketToDevice(trimmed, socket);

  try {
    await markDeviceOnline(trimmed, {
      ...metadata,
      via: 'socket',
      lastSocketHandshake: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('deviceCommandQueue: failed to mark device online during socket registration', error && error.message ? error.message : error);
  }

  await dispatchPendingCommands(trimmed);
}

function deregisterSocket(hardwareId, socket) {
  if (!hardwareId) return;
  removeSocketForDevice(String(hardwareId).trim(), socket);
}

module.exports = {
  getDefaultDeviceId,
  registerSocket,
  deregisterSocket,
  queueActuatorCommand,
  dispatchPendingCommands,
  markCommandPending,
  markCommandCompleted,
  handleCommandAck,
  reserveNextCommand,
  startCommandRetryLoop,
};
