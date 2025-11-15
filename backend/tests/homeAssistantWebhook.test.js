const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

process.env.HOME_ASSISTANT_WEBHOOK_SECRET = 'test-secret';
process.env.HOME_ASSISTANT_DEVICE_ID = 'ha-test-device';

jest.mock('../models/SensorData', () => ({
  create: jest.fn(async (payload) => ({ ...payload })),
  destroy: jest.fn(async () => 0),
  findAll: jest.fn(async () => []),
}));

jest.mock('../models/SensorSnapshot', () => ({
  upsert: jest.fn(async (payload) => payload),
}));

jest.mock('../services/deviceManager', () => ({
  markDeviceOnline: jest.fn(async () => ({})),
}));

jest.mock('../utils/sensorEvents', () => ({
  resolveIo: () => ({ emit: jest.fn() }),
  broadcastSensorData: jest.fn(),
  checkThresholds: jest.fn(async () => []),
}));

jest.mock('../middleware/auth', () => ({
  auth: (req, res, next) => {
    req.user = { id: 'test-admin' };
    next();
  },
}));

const SensorData = require('../models/SensorData');
const SensorSnapshot = require('../models/SensorSnapshot');
const deviceManager = require('../services/deviceManager');
const sensorEvents = require('../utils/sensorEvents');

const homeAssistantRoutes = require('../routes/homeAssistant');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.set('io', { emit: jest.fn() });
  app.use('/api/ha', homeAssistantRoutes);
  return app;
};

describe('Home Assistant webhook route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts signed payloads and stores telemetry', async () => {
    const app = buildApp();
    const payload = {
      deviceId: 'ha-test-device',
      timestamp: new Date().toISOString(),
      metrics: {
        temperature: 22.5,
        humidity: 55.1,
        moisture: 40,
      },
    };
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', process.env.HOME_ASSISTANT_WEBHOOK_SECRET).update(bodyString).digest('hex');

    const res = await request(app)
      .post('/api/ha/webhook')
      .set('X-HA-Signature', signature)
      .send(payload);

    expect(res.status).toBe(201);
    expect(SensorData.create).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'ha-test-device',
      source: 'home_assistant',
    }));
    expect(SensorSnapshot.upsert).toHaveBeenCalled();
    expect(deviceManager.markDeviceOnline).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
    expect(sensorEvents.broadcastSensorData).toHaveBeenCalled();
  });

  it('rejects invalid signatures', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/ha/webhook')
      .set('X-HA-Signature', 'bad-signature')
      .send({ metrics: { temperature: 20 } });

    expect(res.status).toBe(401);
    expect(SensorData.create).not.toHaveBeenCalled();
  });
});
