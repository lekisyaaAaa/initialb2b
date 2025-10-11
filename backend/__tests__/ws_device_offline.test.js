const WebSocket = require('ws');
const request = require('supertest');
const app = require('../test-utils/testServerHelper');
const Device = require('../models/Device');
const { markDeviceOffline } = require('../services/deviceManager');

test('WebSocket receives device_offline when device marked offline', () => {
  jest.setTimeout(20000);
  return new Promise(async (resolve, reject) => {
    const server = app.server;
    // Wait for server to have an address assigned
    let addr = server.address();
    for (let i = 0; i < 50 && !addr; i++) {
      await new Promise(r => setTimeout(r, 50));
      addr = server.address();
    }
    if (!addr) return reject(new Error('Server address not available'));
    const wsUrl = `ws://127.0.0.1:${addr.port}`;

    const deviceId = 'ws-test-device';
    // ensure device exists and online
    try {
      await request(app).post('/api/devices/heartbeat').send({ deviceId }).expect(200);
    } catch (e) {
      return reject(e);
    }

    const ws = new WebSocket(wsUrl);
    let timeout = null;

    ws.on('open', async () => {
      // mark device offline after small delay to allow registration
      setTimeout(async () => {
        try {
          await markDeviceOffline(deviceId);
        } catch (e) {}
      }, 100);
    });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed && parsed.type === 'device_offline' && parsed.deviceId === deviceId) {
          clearTimeout(timeout);
          try { ws.close(); } catch (e) {}
          return resolve();
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      try { ws.close(); } catch (e) {}
      clearTimeout(timeout);
      return reject(err);
    });

    // Safety timeout
    timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      return reject(new Error('Timeout waiting for device_offline'));
    }, 15000);
  });
});
