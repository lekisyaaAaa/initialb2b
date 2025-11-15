const { parseSubscriptions, DeviceThrottle } = require('../services/mqttHelpers');

describe('mqttHelpers.parseSubscriptions', () => {
  test('parses CSV with qos', () => {
    const csv = 'topic/one:1, topic/two:2, topic/three';
    const out = parseSubscriptions(csv);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ topic: 'topic/one', qos: 1 });
    expect(out[1]).toEqual({ topic: 'topic/two', qos: 2 });
    expect(out[2]).toEqual({ topic: 'topic/three', qos: 0 });
  });

  test('handles empty or null inputs', () => {
    expect(parseSubscriptions('')).toEqual([]);
    expect(parseSubscriptions(null)).toEqual([]);
  });
});

describe('mqttHelpers.DeviceThrottle', () => {
  test('throttles messages within window', () => {
    const thr = new DeviceThrottle({ windowMs: 200 });
    thr.clear();
    const dev = 'dev-1';
    const now = Date.now();
    const first = thr.shouldThrottle(dev, now);
    expect(first).toBe(false);
    const second = thr.shouldThrottle(dev, now + 100);
    expect(second).toBe(true);
    const third = thr.shouldThrottle(dev, now + 300);
    expect(third).toBe(false);
  });
});
