const http = require('http');

const data = JSON.stringify({ username: 'admin', password: 'admin' });

const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 5000,
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log('Body:', JSON.parse(body));
    } catch (e) {
      console.log('Body (raw):', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});
req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});
req.write(data);
req.end();
