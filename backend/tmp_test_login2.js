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
  },
  timeout: 5000
};
const req = http.request(opts, (res) => {
  console.log('STATUS', res.statusCode);
  console.log('HEADERS', JSON.stringify(res.headers));
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('BODY', body);
  });
});
req.on('error', (e) => {
  console.error('REQUEST ERROR', e && e.message ? e.message : e);
});
req.write(data);
req.end();
