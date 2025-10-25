const request = require('supertest');
const express = require('express');

jest.mock('axios');
const axios = require('axios');

jest.mock('../middleware/auth', () => ({
  auth: (req, _res, next) => {
    req.user = { id: 42, username: 'test-admin' };
    next();
  },
  adminOnly: (_req, _res, next) => next(),
}));

const ensureDatabaseSetupMock = jest.fn(() => Promise.resolve());

jest.mock('../services/database_pg', () => ({
  ensureDatabaseSetup: jest.fn(() => Promise.resolve()),
}));

const updateActuatorStatusMock = jest.fn();
const sanitizeActuatorMock = jest.fn((actuator) => ({
  id: actuator.id,
  name: actuator.name,
  status: actuator.status,
  mode: actuator.mode,
}));

jest.mock('../services/actuatorService', () => ({
  ensureDefaultActuators: jest.fn(() => Promise.resolve()),
  listActuators: jest.fn(async () => [{ id: 1, name: 'Water Pump', type: 'pump', status: false, mode: 'manual' }]),
  findActuatorById: jest.fn(async () => ({
    id: 1,
    name: 'Water Pump',
    mode: 'manual',
    status: false,
    setDataValue: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  })),
  updateActuatorStatus: (...args) => updateActuatorStatusMock(...args),
  updateActuatorMode: jest.fn(),
  runAutomaticControl: jest.fn(),
  scheduleAutomaticControl: jest.fn(),
  sanitizeActuator: (...args) => sanitizeActuatorMock(...args),
}));

jest.mock('../models/ActuatorLog', () => ({
  create: jest.fn().mockResolvedValue(undefined),
}));

const actuatorRoutes = require('../routes/actuators');
const { sendCommand } = require('../services/espController');

const app = express();
app.use(express.json());
app.use('/api/admin/actuators', actuatorRoutes);

describe('ESP32 actuator dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ESP32_URL = 'http://esp32.local';
    process.env.ESP32_COMMAND_TIMEOUT_MS = '2000';
  });

  it('posts commands to the ESP32 endpoint and returns data', async () => {
    axios.post.mockResolvedValueOnce({ status: 200, data: { ok: true } });
    const result = await sendCommand('Water Pump', 'ON');
    expect(result).toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'http://esp32.local/command',
      expect.objectContaining({ actuator: 'Water Pump', command: 'ON' }),
      expect.objectContaining({ timeout: 2000 })
    );
  });

  it('retries once when initial request fails', async () => {
    axios.post
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const result = await sendCommand('Solenoid Valve', 'OFF');
    expect(result).toEqual({ ok: true });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('throws after retry exhaustion', async () => {
    axios.post.mockRejectedValue(new Error('Offline'));

    await expect(sendCommand('Water Pump', 'ON')).rejects.toThrow('Offline');
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('returns 502 when actuator dispatch reports unreachable ESP32', async () => {
    updateActuatorStatusMock.mockResolvedValueOnce({
      changed: false,
      actuator: { id: 1, name: 'Water Pump', status: false, mode: 'manual' },
      error: 'ESP offline',
    });

    const res = await request(app)
      .post('/api/admin/actuators/1/toggle')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('esp_unreachable');
  });

  it('returns success when actuator toggled without ESP errors', async () => {
    updateActuatorStatusMock.mockResolvedValueOnce({
      changed: true,
      actuator: { id: 1, name: 'Water Pump', status: true, mode: 'manual' },
    });

    const res = await request(app)
      .post('/api/admin/actuators/1/toggle')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: 1, name: 'Water Pump' });
  });
});
