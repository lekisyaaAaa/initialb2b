const http = require('http');
const net = require('net');

const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 5000;
const path = process.env.PATHNAME || '/';

function buildUpgradeRequest(host, port, path) {
  const key = Buffer.from(Math.random().toString()).toString('base64');
  return [
    `GET ${path} HTTP/1.1`,
    `Host: ${host}:${port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '\r\n'
  ].join('\r\n');
}

function doHandshake() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      const req = buildUpgradeRequest(host, port, path);
      socket.write(req);
    });

    let data = '';
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('Socket timeout'));
    });

    socket.on('data', chunk => {
      data += chunk.toString('utf8');
      // If we have full headers, decide
      if (data.includes('\r\n\r\n')) {
        socket.end();
        resolve(data);
      }
    });

    socket.on('error', err => reject(err));
    socket.on('end', () => {
      if (!data) reject(new Error('Connection closed without data'));
    });
  });
}

(async function main(){
  console.log(`Checking WebSocket handshake at ws://${host}:${port}${path}`);
  try {
    const resp = await doHandshake();
    const statusLine = resp.split('\r\n')[0] || '';
    console.log('Received response status:', statusLine);
    console.log('--- Response headers ---\n' + resp.split('\r\n\r\n')[0]);
    if (/101/i.test(statusLine)) {
      console.log('Server accepted upgrade (HTTP 101 Switching Protocols). WebSocket likely available.');
      process.exit(0);
    } else {
      console.log('Server did NOT accept upgrade.');
      process.exit(2);
    }
  } catch (err) {
    console.error('Handshake failed:', err && err.message? err.message : err);
    process.exit(3);
  }
})();
