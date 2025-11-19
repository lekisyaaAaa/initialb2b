const request = require('supertest');
const db = require('../services/database_pg');
const Device = require('../models/Device');
const SensorSnapshot = require('../models/SensorSnapshot');

process.env.HOME_ASSISTANT_DEVICE_ID = 'ha-rest-ingest-test';

const app = require('../test-utils/testServerHelper');

jest.setTimeout(20000);

describe('POST /api/sensors/ingest-ha', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  beforeEach(async () => {
    await Device.destroy({ where: {} });
    await SensorSnapshot.destroy({ where: {} });
  });

  afterAll(async () => {
    if (typeof db.close === 'function') {
      try {
        await db.close();
      } catch (error) {
        // ignore cleanup
      }
    }
  });

  test('persists snapshot and marks device online', async () => {
    const payload = {
      temperature: 24.2,
      humidity: 51,
      soil_moisture: 410,
    };

    const res = await request(app)
      .post('/api/sensors/ingest-ha')
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);

    const device = await Device.findOne({ where: { deviceId: process.env.HOME_ASSISTANT_DEVICE_ID } });
    expect(device).toBeTruthy();
    expect(device.status).toBe('online');
    expect(device.lastHeartbeat).toBeTruthy();

    const snapshot = await SensorSnapshot.findByPk(process.env.HOME_ASSISTANT_DEVICE_ID);
    expect(snapshot).toBeTruthy();
    expect(Number(snapshot.temperature)).toBeCloseTo(24.2, 1);
  });
});
