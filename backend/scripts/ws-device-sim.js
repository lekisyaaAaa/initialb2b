#!/usr/bin/env node
// Simple WebSocket device simulator for local testing
// Usage: node ws-device-sim.js [wsUrl] [deviceId]
// Example: node ws-device-sim.js ws://localhost:5000 esp32-test-01

const WebSocket = require('ws');

const wsUrl = process.argv[2] || process.env.WS_URL || 'ws://localhost:5000';
const deviceId = process.argv[3] || process.env.DEVICE_ID || 'esp32-test-01';
const registerMsg = { type: 'register', deviceId, firmware: 'sim-v1.0' };

console.log(`Connecting to ${wsUrl} as deviceId=${deviceId}`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('WebSocket open - sending register');
  ws.send(JSON.stringify(registerMsg));

  // send heartbeat every 30s
  setInterval(() => {
    const hb = { type: 'heartbeat', deviceId, timestamp: new Date().toISOString() };
    ws.send(JSON.stringify(hb));
    console.log('Sent heartbeat');
  }, 30000);

  // send a sample sensor update after 5s
  setTimeout(() => {
    const s = { type: 'sensor:update', deviceId, data: { temperature: 22.5, humidity: 55.2 }, timestamp: new Date().toISOString() };
    ws.send(JSON.stringify(s));
    console.log('Sent initial sensor update');
  }, 5000);
});

ws.on('message', (raw) => {
  try {
    const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
    console.log('Received message from server:', msg);
    if (msg && msg.type === 'actuator:command') {
      console.log('Received actuator command:', msg.action || msg);
      // simulate executing the command and reply with ack
      const ack = { type: 'actuator:ack', deviceId, commandId: msg.commandId || null, status: 'ok', timestamp: new Date().toISOString() };
      ws.send(JSON.stringify(ack));
      console.log('Sent actuator ack');
    }
  } catch (e) {
    console.warn('Could not parse message from server', e && e.message ? e.message : e);
  }
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed', code, reason && reason.toString());
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('WebSocket error', err && (err.message || err));
});

process.on('SIGINT', () => {
  console.log('Interrupted, closing ws');
  try { ws.close(); } catch(e) {}
  process.exit(0);
});
