jest.mock('../services/deviceCommandQueue', () => ({
  queueActuatorCommand: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../services/database_pg');
const ActuatorState = require('../models/ActuatorState');
const ActuatorLog = require('../models/ActuatorLog');
const deviceCommandQueue = require('../services/deviceCommandQueue');

const app = require('../test-utils/testServerHelper');

jest.setTimeout(20000);

describe('Actuator override route', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  afterAll(async () => {
    try {
      await db.close();
    } catch (error) {
      // ignore cleanup
    }
  });

  test('persists overrides, logs action, and queues device command', async () => {
    const token = jwt.sign({ id: 'admin-local', role: 'admin' }, process.env.JWT_SECRET || 'testsecret');

    const payload = {
      deviceId: 'esp32-A-override',
      actuatorKey: 'water_pump',
      state: { on: true, mode: 'manual' },
      actuatorType: 'pump',
      reason: 'unit-test',
    };

    const res = await request(app)
      .post('/api/actuators/override')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);

    const stateRow = await ActuatorState.findOne({ where: { actuatorKey: 'water_pump' }, order: [['reported_at', 'DESC']] });
    expect(stateRow).toBeTruthy();
    expect(stateRow.state.on).toBe(true);

    const logRow = await ActuatorLog.findOne({ where: { deviceId: 'esp32-A-override' }, order: [['timestamp', 'DESC']] });
    expect(logRow).toBeTruthy();
    expect(logRow.reason).toBe('unit-test');

    expect(deviceCommandQueue.queueActuatorCommand).toHaveBeenCalledWith(expect.objectContaining({
      hardwareId: 'esp32-A-override',
      actuatorName: 'water_pump',
    }));
  });
});
