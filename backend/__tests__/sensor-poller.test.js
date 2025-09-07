const { normalize } = require('../services/sensor-poller');

test('normalize temperature reading', () => {
  const raw = { id: 'esp32-1', type: 'temperature', value: '24.3', unit: 'C' };
  const n = normalize(raw);
  expect(n.sensorId).toBe('esp32-1');
  expect(n.type).toBe('temperature');
  expect(typeof n.timestamp).toBe('string');
  expect(n.value).toBeCloseTo(24.3);
});

test('normalize unknown type -> other', () => {
  const raw = { sensorId: 's1', m: 'light', v: 10 };
  const n = normalize(raw);
  expect(n.type).toBe('other');
  expect(n.sensorId).toBe('s1');
});
