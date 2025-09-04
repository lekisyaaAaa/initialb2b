const http = require('http');

const req = http.get('http://localhost:3002/ws', (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);

  res.on('data', (chunk) => {
    console.log('Response:', chunk.toString());
  });

  res.on('end', () => {
    console.log('Request completed');
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});
