const request = require('supertest');
const db = require('../services/database_pg');
const DeviceEvent = require('../models/DeviceEvent');

process.env.RS485_SECRET = 'rs485-test-secret';

const app = require('../test-utils/testServerHelper');

jest.setTimeout(20000);

describe('RS485 telemetry endpoint', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  afterAll(async () => {
    try {
      await db.close();
    } catch (error) {
      // ignore cleanup issues
    }
  });

  test('rejects requests without the shared secret', async () => {
    const res = await request(app)
      .post('/api/rs485/telemetry')
      .send({ deviceId: 'rs485-unauth', temperature: 18 })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  test('accepts telemetry with the correct secret and stores a DeviceEvent', async () => {
    const payload = { deviceId: 'rs485-test-001', temperature: 19.5 };

    const res = await request(app)
      .post('/api/rs485/telemetry')
      .set('x-rs485-secret', process.env.RS485_SECRET)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);

    const eventRow = await DeviceEvent.findOne({ where: { deviceId: 'rs485-test-001' } });
    expect(eventRow).toBeTruthy();
  });
});
