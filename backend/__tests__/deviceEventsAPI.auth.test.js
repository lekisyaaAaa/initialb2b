const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../services/database_pg');
const app = require('../server');
const User = require('../models/User');

jest.setTimeout(20000);

describe('Device Events admin API auth checks', () => {
  let nonAdminUser = null;
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
    // create a non-admin user in the test DB so auth middleware will accept the token
    nonAdminUser = await User.create({ username: 'test-user', password: 'testing', role: 'user' });
  });

  afterAll(async () => {
    try { await db.close(); } catch (e) {}
  });

  test('GET /api/device-events without token returns 401', async () => {
    const res = await request(app).get('/api/device-events');
    expect(res.status).toBe(401);
    expect(res.body && res.body.success).toBeFalsy();
  });

  test('GET /api/device-events with non-admin token returns 403', async () => {
    const token = jwt.sign({ id: nonAdminUser.id, role: 'user' }, process.env.JWT_SECRET || 'testsecret');
    const res = await request(app).get('/api/device-events').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body && res.body.success).toBeFalsy();
  });
});
