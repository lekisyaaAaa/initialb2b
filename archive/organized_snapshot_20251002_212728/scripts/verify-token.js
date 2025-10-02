const fs = require('fs');
const http = require('http');

(async function(){
  try {
    const tokenPath = 'scripts/ui-login.token';
    if (!fs.existsSync(tokenPath)) {
      console.error('Token file not found:', tokenPath);
      process.exit(2);
    }
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    if (!token) {
      console.error('Token file empty');
      process.exit(2);
    }

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/verify',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 5000
    };

    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.end();
    });

    if (res.statusCode === 200) {
      console.log('Token verify OK');
      console.log(res.body);
      process.exit(0);
    }
    console.error('Token verify failed with status', res.statusCode);
    console.error(res.body);
    process.exit(3);

  } catch (e) {
    console.error('verify-token error', e && e.message ? e.message : e);
    process.exit(4);
  }
})();
