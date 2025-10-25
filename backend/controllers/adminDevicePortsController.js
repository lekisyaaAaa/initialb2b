const devicePortsService = require('../services/devicePortsService');

exports.enumerate = async (req, res) => {
  const { deviceId } = req.params;
  try {
    const result = await devicePortsService.enumerateDevicePorts(deviceId);
    return res.json({
      success: true,
      ports: result.ports,
      meta: {
        devicePingable: result.devicePingable,
        commandId: result.commandId,
        hardwareId: result.hardwareId,
        source: result.source,
      },
    });
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    console.error('Port enumerate error', error && error.message ? error.message : error);
    return res.status(status).json({
      success: false,
      message: error && error.message ? error.message : 'Enumeration failed',
    });
  }
};

exports.list = async (req, res) => {
  const { deviceId } = req.params;
  try {
    const ports = await devicePortsService.listKnownDevicePorts(deviceId);
    return res.json({ success: true, ports });
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    console.error('Port listing error', error && error.message ? error.message : error);
    return res.status(status).json({
      success: false,
      message: error && error.message ? error.message : 'Failed to load ports',
    });
  }
};

exports.assign = async (req, res) => {
  const { deviceId } = req.params;
  const adminUserId = req.user && req.user.id !== undefined ? req.user.id : null;
  try {
    const record = await devicePortsService.assignPort(deviceId, req.body, adminUserId);
    return res.json({ success: true, data: record });
  } catch (error) {
    const status = error && error.status ? error.status : 500;
    console.error('Port assign error', error && error.message ? error.message : error);
    return res.status(status).json({
      success: false,
      message: error && error.message ? error.message : 'Assign failed',
    });
  }
};
