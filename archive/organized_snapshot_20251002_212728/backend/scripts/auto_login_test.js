const http = require('http');
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'logs', 'auto_login_test.log');
function write(line){ fs.appendFileSync(out, new Date().toISOString() + ' ' + line + '\n'); }

function runTest(){
  const data = JSON.stringify({ username: 'admin', password: 'admin' });
  const opts = { hostname: '127.0.0.1', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
  const req = http.request(opts, (res) => {
    let body = '';
    res.on('data', c => body += c.toString());
    res.on('end', () => {
      write(`STATUS=${res.statusCode} BODY=${body.slice(0,400).replace(/\n/g,' ')} `);
    });
  });
  req.on('error', (e) => write('ERROR '+ e.message));
  req.write(data); req.end();
}

write('auto_login_test started');
runTest();
setInterval(runTest, 10000); // every 10s
