const NodeCache = require('node-cache');

// Parse CSV subscription list. Format: "topic1:1,topic2,topic3:0"
// Returns array of { topic, qos }
function parseSubscriptions(csv) {
  if (!csv) return [];
  return csv.split(',').map((part) => {
    const s = part.trim();
    if (!s) return null;
    const [t, q] = s.split(':').map((v) => v.trim());
    const qos = (q !== undefined && q !== '') ? Math.min(2, Math.max(0, parseInt(q, 10) || 0)) : 0;
    return { topic: t, qos };
  }).filter(Boolean);
}

// Simple per-device throttle manager
class DeviceThrottle {
  constructor(opts = {}) {
    this.windowMs = opts.windowMs || parseInt(process.env.MQTT_DEVICE_THROTTLE_MS || '5000', 10);
    this.cache = new NodeCache({ stdTTL: Math.ceil(this.windowMs / 1000) + 2, checkperiod: Math.max(1, Math.floor(this.windowMs / 2000)) });
  }

  // Returns true if message should be throttled/dropped
  shouldThrottle(deviceId, now = Date.now()) {
    if (!deviceId) return false;
    const last = this.cache.get(String(deviceId));
    if (!last) {
      this.cache.set(String(deviceId), now);
      return false;
    }
    if ((now - last) < this.windowMs) return true;
    this.cache.set(String(deviceId), now);
    return false;
  }

  // Clear cache (for tests)
  clear() { this.cache.flushAll(); }
}

module.exports = {
  parseSubscriptions,
  DeviceThrottle,
};
