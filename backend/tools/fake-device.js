// fake-device.js - simple Socket.IO client to simulate an ESP32 device
// Usage: node tools/fake-device.js <deviceId> <serverUrl>
// Example: node tools/fake-device.js device-1 https://vermilinks-backend.onrender.com

const io = require('socket.io-client');

const deviceId = process.argv[2] || 'device-1';
const server = process.argv[3] || 'https://vermilinks-backend.onrender.com';

console.log('Starting fake device', deviceId, '->', server);

const socket = io(server, {
  auth: { deviceId },
  transports: ['websocket'],
  reconnection: false,
  timeout: 10000,
});

socket.on('connect', () => {
  console.log('Connected to server, socket id:', socket.id);
});

socket.on('command:issue', (payload) => {
  try {
    console.log('Received command:issue ->', JSON.stringify(payload));
    // Simulate processing then ack with success
    const ack = {
      commandId: payload && payload.commandId ? payload.commandId : null,
      status: 'ok',
      payload: { result: 'simulated-success' },
      message: 'Simulated device executed command',
    };
    setTimeout(() => {
      console.log('Sending command:ok ack for', ack.commandId);
      socket.emit('command:ok', ack);
    }, 500);
  } catch (err) {
    console.error('Error handling command', err && err.message ? err.message : err);
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error('Connect error:', err && err.message ? err.message : err);
  process.exit(1);
});
