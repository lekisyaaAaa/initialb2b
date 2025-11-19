process.env.HOME_ASSISTANT_DEVICE_ID = 'ha-device-test';

const request = require('supertest');
const db = require('../services/database_pg');
const Device = require('../models/Device');
const SensorSnapshot = require('../models/SensorSnapshot');

const app = require('../test-utils/testServerHelper');

jest.setTimeout(20000);

describe('Devices listing with Home Assistant snapshot fallback', () => {
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
        // ignore cleanup errors
      }
    }
  });

  test('injects synthetic device when snapshot is fresh', async () => {
    await SensorSnapshot.upsert({
      deviceId: 'ha-device-test',
      temperature: 25.5,
      humidity: 60,
      moisture: 420,
      floatSensor: 1,
      timestamp: new Date(),
    });

    const res = await request(app)
      .get('/api/devices')
      .expect(200);

    expect(res.body.success).toBe(true);
    const entry = res.body.data.find((device) => device.deviceId === 'ha-device-test');
    expect(entry).toBeTruthy();
    expect(entry.status).toBe('online');
    expect(entry.metadata).toBeTruthy();
    expect(entry.metadata.synthetic).toBe(true);
    expect(entry.metadata.source).toBe('home_assistant_snapshot');
  });

  test('overrides offline device when snapshot is fresh', async () => {
    const stale = new Date(Date.now() - 10 * 60 * 1000);
    await Device.create({
      deviceId: 'ha-device-test',
      status: 'offline',
      lastHeartbeat: stale,
      metadata: { note: 'stale-test' },
    });
    await SensorSnapshot.upsert({
      deviceId: 'ha-device-test',
      temperature: 26.9,
      humidity: 52,
      moisture: 450,
      floatSensor: 0,
      timestamp: new Date(),
    });

    const res = await request(app)
      .get('/api/devices')
      .expect(200);

    expect(res.body.success).toBe(true);
    const entry = res.body.data.find((device) => device.deviceId === 'ha-device-test');
    expect(entry).toBeTruthy();
    expect(entry.status).toBe('online');
    expect(entry.metadata).toBeTruthy();
    expect(entry.metadata.synthetic).toBe(true);
    expect(entry.metadata.note).toBe('stale-test');
    expect(new Date(entry.lastHeartbeat).getTime()).toBeGreaterThan(stale.getTime());
  });
});
