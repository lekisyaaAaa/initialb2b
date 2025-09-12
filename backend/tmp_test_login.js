const axios = require('axios');
(async () => {
  try {
    const url = 'http://127.0.0.1:5000/api/auth/login';
    console.log('Posting to', url);
    const resp = await axios.post(url, { username: 'admin', password: 'admin' }, { timeout: 5000 });
    console.log('STATUS', resp.status);
    console.log('DATA', JSON.stringify(resp.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.error('ERR STATUS', e.response.status);
      try { console.error('ERR DATA', JSON.stringify(e.response.data, null, 2)); } catch(_) { console.error('ERR DATA RAW', e.response.data); }
    } else {
      console.error('REQUEST ERROR', e && e.message ? e.message : e);
    }
    process.exit(1);
  }
})();
