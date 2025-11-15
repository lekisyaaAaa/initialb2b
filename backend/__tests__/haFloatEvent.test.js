const request = require('supertest');
const db = require('../services/database_pg');
const DeviceEvent = require('../models/DeviceEvent');
const app = require('../server');

jest.setTimeout(20000);

describe('HA float endpoint', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  afterAll(async () => {
    try { await db.close(); } catch (e) {}
  });

  test('POST /api/ha/float creates DeviceEvent and returns 201', async () => {
    const res = await request(app)
      .post('/api/ha/float')
      .send({ deviceId: 'test-ha-device', level: 'HIGH' })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    const ev = await DeviceEvent.findOne({ where: { deviceId: 'test-ha-device' } });
    expect(ev).toBeTruthy();
  });
});
