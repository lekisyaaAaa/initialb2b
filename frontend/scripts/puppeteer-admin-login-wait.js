const puppeteer = require('puppeteer');

async function run(url) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try { console.log('PAGE:', msg.type(), msg.text()); } catch(e) {} });
  page.on('pageerror', err => { console.error('PAGE_ERROR:', err && err.message ? err.message : String(err)); });
  // Instrument page to capture fetch/XHR calls and console events before any script runs
  await page.evaluateOnNewDocument(() => {
    window.__apiCalls = window.__apiCalls || [];
    window.__events = window.__events || [];
    // wrap fetch
    const _fetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        window.__apiCalls.push({ type: 'fetch', url, init });
      } catch (e) {}
      return _fetch.apply(this, arguments);
    };
    // wrap XHR
    const XHR = window.XMLHttpRequest;
    function WrappedXHR() {
      const xhr = new XHR();
      const open = xhr.open;
      const send = xhr.send;
      let method = '';
      let url = '';
      xhr.open = function(m, u) {
        method = m; url = u;
        return open.apply(xhr, arguments);
      };
      xhr.send = function(body) {
        try { window.__apiCalls.push({ type: 'xhr', method, url, body }); } catch(e) {}
        return send.apply(xhr, arguments);
      };
      return xhr;
    }
    window.XMLHttpRequest = WrappedXHR;
    // capture DOM events array if not already present
    window.addEventListener('error', (ev) => { try { window.__events.push({ type: 'error', message: ev.message }); } catch(e) {} });
    const _consoleLog = console.log.bind(console);
    console.log = function() { try { window.__events.push({ type: 'console', args: Array.from(arguments) }); } catch(e) {} _consoleLog.apply(console, arguments); };
  });
  await page.setRequestInterception(true);
  page.on('request', req => {
    // Continue all requests but log API calls
    if (req.url().includes('/api/')) {
      console.log('REQUEST ->', req.method(), req.url());
    }
    req.continue();
  });
  page.on('response', async resp => {
    try {
      if (resp.url().includes('/api/')) {
        const txt = await resp.text();
        console.log('RESPONSE <-', resp.status(), resp.url(), txt.slice(0,200));
      }
    } catch (e) {}
  });
  await page.goto(url + '/admin/login', { waitUntil: 'networkidle2', timeout: 20000 });

  // Wait for form fields and type
  await page.waitForSelector('#username', { timeout: 5000 });
  await page.type('#username', 'admin');
  await page.type('#password', 'admin');

  // Wait for submit to be enabled
  const beforeState = await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    const usernameEl = document.querySelector('#username');
    const passwordEl = document.querySelector('#password');
    const username = usernameEl && (usernameEl.value || usernameEl.getAttribute('value'));
    const password = passwordEl && (passwordEl.value || passwordEl.getAttribute('value'));
    return { disabled: !!btn && !!btn.disabled, username, password };
  });
  console.log('Before click state:', beforeState);
  // Attach listeners to capture submit/click events
  await page.evaluate(() => {
    (window).__events = [];
    const btn = document.querySelector('button[type="submit"]');
    const form = document.querySelector('form');
    if (btn) btn.addEventListener('click', (ev) => { (window).__events.push({ type: 'click', time: Date.now() }); });
    if (form) form.addEventListener('submit', (ev) => { (window).__events.push({ type: 'submit', time: Date.now() }); });
  });
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return !!btn && !(btn.disabled);
  }, { timeout: 10000 });

  // Attach native listeners to capture if native submit/click events fire
  await page.evaluate(() => {
    try {
      window.__nativeEvents = window.__nativeEvents || [];
      const form = document.querySelector('form');
      const btn = document.querySelector('button[type="submit"]');
      if (form) form.addEventListener('submit', (e) => { window.__nativeEvents.push({ type: 'native-submit', time: Date.now() }); });
      if (btn) btn.addEventListener('click', (e) => { window.__nativeEvents.push({ type: 'native-click', time: Date.now() }); });
    } catch (e) {}
  });

  // Try clicking the submit button first
  await page.click('button[type="submit"]');
  await page.evaluate(() => new Promise(res => setTimeout(res, 500)));

  // If no API calls observed, dispatch a native submit event directly
  const apiCallsAfterClick = await page.evaluate(() => window.__apiCalls || []);
  if (!apiCallsAfterClick || apiCallsAfterClick.length === 0) {
    await page.evaluate(() => {
      try {
        const form = document.querySelector('form');
        if (form) {
          // dispatch a submit event to trigger any listeners
          const ev = new Event('submit', { bubbles: true, cancelable: true });
          form.dispatchEvent(ev);
          // also call form.requestSubmit if available
          if (form.requestSubmit) try { form.requestSubmit(); } catch(e) {}
        }
      } catch (e) {}
    });
  }

  await page.evaluate(() => new Promise(res => setTimeout(res, 500)));

  // Collect diagnostics captured in the page
  const stored = await page.evaluate(() => ({ token: localStorage.getItem('token'), adminToken: localStorage.getItem('adminToken'), user: localStorage.getItem('user') }));
  const apiCalls = await page.evaluate(() => window.__apiCalls || []);
  const events = await page.evaluate(() => window.__events || []);
  console.log('Final URL:', page.url());
  console.log('LocalStorage after submit:', stored);
  console.log('Page-captured API calls:', apiCalls);
  console.log('Page-captured events:', events.slice(-10));
  await browser.close();
}

const argv = require('minimist')(process.argv.slice(2));
const url = argv.url || 'http://127.0.0.1:5000';
run(url).catch(err => { console.error(err); process.exit(1); });
