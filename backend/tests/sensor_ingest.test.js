const request = require('supertest');
const express = require('express');

jest.mock('../models/SensorData', () => ({
  create: jest.fn(),
  sequelize: {},
}));

jest.mock('../models/SensorSnapshot', () => ({
  upsert: jest.fn(async () => null),
}));

jest.mock('../models/Alert', () => ({
  createAlert: jest.fn(async (payload) => payload),
}));

jest.mock('../models/Settings', () => ({
  getSettings: jest.fn(async () => ({ thresholds: {} })),
}));

jest.mock('../models/Device', () => ({
  findOne: jest.fn(),
}));

jest.mock('../services/deviceManager', () => ({
  markDeviceOnline: jest.fn(async () => ({ status: 'online', lastHeartbeat: new Date() })),
  markDeviceOffline: jest.fn(),
  resetOfflineTimer: jest.fn(),
}));

const sensorsRoute = require('../routes/sensors');
const SensorData = require('../models/SensorData');
const Device = require('../models/Device');

const buildApp = (io) => {
  const app = express();
  app.use(express.json());
  app.set('io', io);
  app.use('/api/sensors', sensorsRoute);
  return app;
};

describe('sensor ingestion route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores telemetry and emits telemetry:update', async () => {
    const io = { emit: jest.fn() };
    const app = buildApp(io);

    Device.findOne.mockResolvedValueOnce({
      deviceId: 'ESP32-01',
      status: 'online',
      metadata: {},
      save: jest.fn(),
    });

    const createdRow = {
      deviceId: 'ESP32-01',
      temperature: 22.5,
      humidity: 45.1,
      moisture: 33.3,
      timestamp: new Date().toISOString(),
      get: function (opts) {
        if (opts && opts.plain) {
          return {
            deviceId: this.deviceId,
            temperature: this.temperature,
            humidity: this.humidity,
            moisture: this.moisture,
            timestamp: this.timestamp,
          };
        }
        return this;
      },
    };

    SensorData.create.mockResolvedValueOnce(createdRow);

    const payload = {
      device_id: 'ESP32-01',
      temperature: 22.5,
      humidity: 45.1,
      soil_moisture: 33.3,
      float_sensor: 0,
      timestamp: new Date().toISOString(),
    };

    const res = await request(app).post('/api/sensors').send(payload);

    expect(res.status).toBe(201);
    expect(SensorData.create).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'ESP32-01',
      temperature: 22.5,
      humidity: 45.1,
      moisture: 33.3,
    }));

    // Allow async broadcast to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(io.emit).toHaveBeenCalledWith(
      'telemetry:update',
      expect.objectContaining({ deviceId: 'ESP32-01' }),
    );
  });

  it('skips simulated telemetry', async () => {
    const io = { emit: jest.fn() };
    const app = buildApp(io);

    const res = await request(app).post('/api/sensors').send({
      device_id: 'ESP32-01',
      isSimulated: true,
      temperature: 20,
    });

    expect(res.status).toBe(204);
    expect(SensorData.create).not.toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalledWith('telemetry:update', expect.anything());
  });
});
