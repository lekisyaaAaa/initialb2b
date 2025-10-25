// Minimal integration smoke test for local dev
// Usage: node scripts/integration-smoke.js

(async function(){
  try{
    const backend = 'http://localhost:5000';
    const frontend = 'http://localhost:3002';

    const out = (label, status, body) => console.log(`${label}: ${status} ${typeof body==='string'? body.replace(/\n/g,' '): JSON.stringify(body)}`);

    // backend health
    const bh = await fetch(`${backend}/api/health`).catch(e=>({ ok:false, status:0, text: async ()=>String(e) }));
    const bht = bh && bh.text ? await bh.text() : '';
    out('BACKEND_HEALTH', bh.status || 0, bht);

    // frontend health
    const fh = await fetch(`${frontend}/health`).catch(e=>({ ok:false, status:0, text: async ()=>String(e) }));
    const fht = fh && fh.text ? await fh.text() : '';
    out('FRONTEND_HEALTH', fh.status || 0, fht);

    // login (optional while new admin auth is under construction)
    const smokeUser = process.env.SMOKE_ADMIN_USER;
    const smokePass = process.env.SMOKE_ADMIN_PASS;
    let loginResp = null;
    let loginBody = '';
    if (smokeUser && smokePass) {
      loginResp = await fetch(`${backend}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: smokeUser, password: smokePass })
      }).catch(e=>({ ok:false, status:0, text: async ()=>String(e) }));
      try { loginBody = await loginResp.text(); } catch(e){ loginBody = String(e); }
      out('LOGIN', loginResp.status || 0, loginBody);
    } else {
      console.log('LOGIN: skipped (set SMOKE_ADMIN_USER/SMOKE_ADMIN_PASS to enable)');
    }

    // Evaluate
    let ok = true;
    if (!bh || bh.status !== 200) ok = false;
    if (!fh || fh.status !== 200) ok = false;
    if (loginResp) {
      let loginJson = null;
      try { loginJson = JSON.parse(loginBody); } catch(e){}
      if (!(loginResp && loginResp.status === 200 && loginJson && loginJson.success)) ok = false;
    }

    if (ok) { console.log('SMOKE_TEST: PASS'); process.exit(0); }
    else { console.error('SMOKE_TEST: FAIL'); process.exit(2); }

  } catch (err) {
    console.error('SMOKE_TEST: ERROR', err);
    process.exit(3);
  }
})();
