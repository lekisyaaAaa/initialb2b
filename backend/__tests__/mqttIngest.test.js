const db = require('../services/database_pg');
const DeviceEvent = require('../models/DeviceEvent');
const SensorData = require('../models/SensorData');
const Alert = require('../models/Alert');
const mqttIngest = require('../services/mqttIngest');

jest.setTimeout(20000);

describe('MQTT ingest', () => {
  beforeAll(async () => {
    await db.ensureDatabaseSetup({ force: true });
  });

  afterAll(async () => {
    try { await db.close(); } catch (e) {}
  });

  test('handleMessage persists DeviceEvent and SensorData and triggers alerts', async () => {
    const payload = { deviceId: 'test-mqtt-device', temperature: 100 };
    await mqttIngest.handleMessage('vermilinks/test', JSON.stringify(payload));

    const ev = await DeviceEvent.findOne({ where: { deviceId: 'test-mqtt-device' } });
    expect(ev).toBeTruthy();

    const sd = await SensorData.findOne({ where: { deviceId: 'test-mqtt-device' } });
    expect(sd).toBeTruthy();

    const alerts = await Alert.findAll({ where: { deviceId: 'test-mqtt-device' } });
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});
