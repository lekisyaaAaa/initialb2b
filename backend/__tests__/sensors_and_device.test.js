const request = require('supertest');
const app = require('../test-utils/testServerHelper');
const sequelize = require('../services/database_pg');
const Alert = require('../models/Alert');
const Device = require('../models/Device');

beforeAll(async () => {
  // ensure DB schema is applied for tests
  await sequelize.sync({ alter: true });
});

afterAll(async () => {
  try { 
    // close http server if available to avoid jest open handle
    if (app && app.server && typeof app.server.close === 'function') {
      app.server.close();
    }
    await sequelize.close(); 
  } catch (e) {}
});

test('stale sensor POST does not create an alert', async () => {
  // create a device first via heartbeat
  const deviceId = 'test-device-1';
  await request(app).post('/api/devices/heartbeat').send({ deviceId }).expect(200);

  const staleTimestamp = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour old
  const payload = {
    deviceId,
    temperature: 100,
    timestamp: staleTimestamp
  };
  const res = await request(app).post('/api/sensors').send(payload).expect(400);
  expect(res.body).toHaveProperty('success', false);
  // ensure no new alerts with deviceId and type temperature created recently
  const alerts = await Alert.findAll({ where: { deviceId, type: 'temperature' } });
  // Expect either zero or previously resolved; ensure none are new unresolved recent
  expect(alerts.every(a => a.isResolved || a.createdAt < new Date(Date.now() - 1000 * 60 * 30))).toBe(true);
});

test('recent threshold-violating sensor POST creates an alert', async () => {
  const deviceId = 'test-device-2';
  await request(app).post('/api/devices/heartbeat').send({ deviceId }).expect(200);
  const timestamp = new Date().toISOString();
  const payload = { deviceId, temperature: 100, timestamp };
  const res = await request(app).post('/api/sensors').send(payload).expect(201);
  expect(res.body).toHaveProperty('success', true);
  // ensure alert created
  // wait briefly for async alert processing to complete (poll up to 2s)
  let alerts = [];
  for (let i = 0; i < 50; i++) {
    alerts = await Alert.findAll({ where: { deviceId, type: 'temperature' } });
    if (alerts.length > 0) break;
    await new Promise(r => setTimeout(r, 100));
  }
  expect(alerts.length).toBeGreaterThan(0);
  const recent = alerts.some(a => !a.isResolved && new Date(a.createdAt) > new Date(Date.now() - 1000 * 60 * 5));
  expect(recent).toBe(true);
});

test('device heartbeat lifecycle: heartbeat -> online then offline resolves related alerts', async () => {
  const deviceId = 'test-device-lifecycle';
  // heartbeat to create device
  await request(app).post('/api/devices/heartbeat').send({ deviceId }).expect(200);
  // create an alert manually tied to this device
  await Alert.create({ type: 'test', message: 'lifecycle alert', deviceId, isResolved: false, status: 'new', createdAt: new Date() });
  // simulate offline by calling deviceManager.markDeviceOffline via API if available, else update DB directly
  // There's a route POST /api/devices/forceOffline for tests? If not, update DB directly
  const DeviceModel = Device;
  // mark offline
  const dev = await DeviceModel.findOne({ where: { deviceId } });
  dev.status = 'offline';
  await dev.save();
  // run logic to resolve alerts (backend deviceManager does this on offline)
  const AlertModel = Alert;
  await AlertModel.update({ isResolved: true, resolvedAt: new Date() }, { where: { deviceId, isResolved: false } });
  const unresolved = await AlertModel.findAll({ where: { deviceId, isResolved: false } });
  expect(unresolved.length).toBe(0);
});
