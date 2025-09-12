const http = require('http');
const data = JSON.stringify({ username: 'admin', password: 'admin' });
const opts = {
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(opts, (res) => {
  let body = '';
  res.on('data', (d) => body += d.toString());
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', body);
  });
});
req.on('error', (e) => console.error('ERR', e.message));
req.write(data);
req.end();
