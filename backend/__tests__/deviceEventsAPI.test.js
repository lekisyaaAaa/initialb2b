const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../services/database_pg');
const DeviceEvent = require('../models/DeviceEvent');
const app = require('../server');

jest.setTimeout(20000);

describe('Device Events admin API', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  afterAll(async () => {
    try { await db.close(); } catch (e) {}
  });

  test('GET /api/device-events returns paginated results and filters by deviceId', async () => {
    // Create 5 events for device A and 3 for device B
    for (let i = 0; i < 5; i++) {
      await DeviceEvent.create({ deviceId: 'dev-A', eventType: 'test', payload: { i }, source: 'unit-test' });
    }
    for (let i = 0; i < 3; i++) {
      await DeviceEvent.create({ deviceId: 'dev-B', eventType: 'test', payload: { i }, source: 'unit-test' });
    }

    const token = jwt.sign({ id: 'admin-local', role: 'admin' }, process.env.JWT_SECRET || 'testsecret');

    // Without filter, default limit should return up to 200
    const resAll = await request(app)
      .get('/api/device-events')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resAll.body.success).toBe(true);
    expect(Array.isArray(resAll.body.data)).toBe(true);

    // Filter by deviceId dev-A and limit 2
    const resA = await request(app)
      .get('/api/device-events')
      .query({ deviceId: 'dev-A', limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resA.body.success).toBe(true);
    expect(Array.isArray(resA.body.data)).toBe(true);
    expect(resA.body.data.length).toBeLessThanOrEqual(2);
    // Ensure all returned rows match deviceId
    resA.body.data.forEach((r) => { expect(r.deviceId === 'dev-A' || r.device_id === 'dev-A').toBeTruthy(); });
  });
});
