jest.mock('../models/DeviceEvent');
jest.mock('../models/SensorData');
jest.mock('../models/SensorSnapshot');
jest.mock('../utils/sensorEvents');

const DeviceEvent = require('../models/DeviceEvent');
const SensorData = require('../models/SensorData');
const SensorSnapshot = require('../models/SensorSnapshot');
const { checkThresholds, broadcastSensorData } = require('../utils/sensorEvents');

const mqttIngest = require('../services/mqttIngest');

describe('mqttIngest handleMessage throttling integration', () => {
  beforeEach(() => {
    // reset mocks
    DeviceEvent.create.mockReset();
    SensorData.create.mockReset();
    SensorSnapshot.upsert.mockReset();
    checkThresholds.mockResolvedValue([]);
    broadcastSensorData.mockImplementation(() => {});
    // clear throttle cache
    if (mqttIngest._deviceThrottle && mqttIngest._deviceThrottle.clear) mqttIngest._deviceThrottle.clear();
  });

  test('first message persists, second message within throttle window is skipped', async () => {
    const topic = 'vermilinks/dev-1/data';
    const payload = JSON.stringify({ deviceId: 'dev-1', temperature: 21 });

    await mqttIngest.handleMessage(topic, Buffer.from(payload));

    expect(DeviceEvent.create).toHaveBeenCalledTimes(1);
    expect(SensorData.create).toHaveBeenCalledTimes(1);

    // send another message immediately (within default 5s throttle)
    await mqttIngest.handleMessage(topic, Buffer.from(payload));

    // DeviceEvent and SensorData should not be called again due to throttle
    expect(DeviceEvent.create).toHaveBeenCalledTimes(1);
    expect(SensorData.create).toHaveBeenCalledTimes(1);
  });

  test('message after throttle window is allowed', async () => {
    const topic = 'vermilinks/dev-2/data';
    const payload = JSON.stringify({ deviceId: 'dev-2', temperature: 22 });

    await mqttIngest.handleMessage(topic, Buffer.from(payload));
    expect(DeviceEvent.create).toHaveBeenCalledTimes(1);

    // simulate time passing by directly manipulating throttle cache
    const thr = mqttIngest._deviceThrottle;
    // set last seen to far in the past
    if (thr && thr.cache) thr.cache.set('dev-2', Date.now() - (thr.windowMs + 100));

    await mqttIngest.handleMessage(topic, Buffer.from(payload));
    expect(DeviceEvent.create).toHaveBeenCalledTimes(2);
  });
});
