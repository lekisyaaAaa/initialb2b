const http = require('http');
const data = JSON.stringify({
  deviceId: 'test-device-1',
  temperature: 22.5,
  humidity: 55,
  moisture: 40,
  batteryLevel: 95
});
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sensors',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  },
  timeout: 5000
};
const req = http.request(options, (res) => {
  let b='';
  res.on('data', c=> b+=c);
  res.on('end', ()=>{
    console.log('STATUS', res.statusCode);
    try{ console.log(JSON.parse(b)); }catch(e){ console.log(b); }
  });
});
req.on('error', e=>{ console.error('ERR', e && e.message ? e.message : e); process.exit(2); });
req.write(data);
req.end();
