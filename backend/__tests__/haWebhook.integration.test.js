const crypto = require('crypto');
const request = require('supertest');
const db = require('../services/database_pg');
const DeviceEvent = require('../models/DeviceEvent');
const SensorData = require('../models/SensorData');

process.env.HOME_ASSISTANT_WEBHOOK_SECRET = 'test-ha-secret';
process.env.HOME_ASSISTANT_DEVICE_ID = 'ha-test-device';

const app = require('../test-utils/testServerHelper');

jest.setTimeout(20000);

const signPayload = (body) => {
  const raw = JSON.stringify(body);
  return crypto.createHmac('sha256', process.env.HOME_ASSISTANT_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
};

describe('Home Assistant webhook integration', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  afterAll(async () => {
    try {
      await db.close();
    } catch (error) {
      // ignore cleanup errors
    }
  });

  test('accepts signed payloads and persists telemetry/device events', async () => {
    const payload = {
      deviceId: 'ha-hook-001',
      timestamp: new Date().toISOString(),
      metrics: {
        temperature: 23.5,
        moisture: 42,
      },
    };

    const res = await request(app)
      .post('/api/ha/webhook')
      .set('x-ha-signature', signPayload(payload))
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceId).toBe('ha-hook-001');

    const eventRow = await DeviceEvent.findOne({ where: { deviceId: 'ha-hook-001', eventType: 'webhook' } });
    expect(eventRow).toBeTruthy();

    const sensorRow = await SensorData.findOne({ where: { deviceId: 'ha-hook-001' } });
    expect(sensorRow).toBeTruthy();
    expect(Number(sensorRow.temperature)).toBeCloseTo(23.5, 1);
  });

  test('rejects unsigned requests when secret is set', async () => {
    const res = await request(app)
      .post('/api/ha/webhook')
      .send({
        deviceId: 'ha-hook-unauth',
        timestamp: new Date().toISOString(),
        metrics: { temperature: 21 },
      })
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
