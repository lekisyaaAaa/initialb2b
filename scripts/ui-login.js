// Clear common Node debug env vars early to prevent noisy MODULE/NET debug output
delete process.env.NODE_DEBUG;
delete process.env.NODE_OPTIONS;
delete process.env.DEBUG;
delete process.env.NPM_CONFIG_LOGLEVEL;

const path = require('path');

const fs = require('fs');
const puppeteer = require('puppeteer');
async function run() {
  const url = process.env.URL || 'http://localhost:3002';
  const username = process.env.UI_USERNAME || 'admin';
  const password = process.env.UI_PASSWORD || 'admin';

  // Output token path (configurable). Use absolute resolved path.
  const TOKEN_OUT = process.env.TOKEN_OUT || 'scripts/ui-login.token';
  const outPath = path.resolve(process.cwd(), TOKEN_OUT);

  const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  console.log('Using Chromium path:', chromiumPath || '<bundled>');
  const launchOptions = { args: ['--no-sandbox','--disable-setuid-sandbox'] };
  // allow forcing headless mode via env ("true"/"false")
  if (process.env.PUPPETEER_HEADLESS) {
    launchOptions.headless = String(process.env.PUPPETEER_HEADLESS).toLowerCase() === 'true';
  }
  if (chromiumPath) launchOptions.executablePath = chromiumPath;
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  // Configurable timeouts for flaky CI environments
  const UI_TIMEOUT_MS = parseInt(process.env.UI_TIMEOUT_MS, 10) || 20000;
  const UI_WAIT_FOR_TOKEN_MS = parseInt(process.env.UI_WAIT_FOR_TOKEN_MS, 10) || 10000;
  page.setDefaultTimeout(UI_TIMEOUT_MS);

  // Log failed network responses which can help debugging login issues
  page.on('response', resp => {
    try {
      if (resp.status() >= 400) console.log('PAGE XHR ERR:', resp.status(), resp.url());
    } catch (e) {}
  });
  page.on('console', msg => {
    try { console.log('PAGE LOG:', msg.text()); } catch(e){}
  });

  try {
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for username/password inputs to appear (SPA may render after JS loads)
    try {
      await page.waitForSelector('#username, input[name=\'username\']', { timeout: UI_TIMEOUT_MS });
    } catch (err) {
      // try /login route
      console.log('Username input not found at root, navigating to /login');
      await page.goto(url + '/login', { waitUntil: 'networkidle2' });
      await page.waitForSelector('#username, input[name=\'username\']', { timeout: UI_TIMEOUT_MS });
    }

    const userEl = await page.$('#username, input[name="username"]');
    const passEl = await page.$('#password, input[name="password"]');
    if (!userEl || !passEl) {
      throw new Error('Login inputs not found on page after navigation');
    }

    await userEl.click({ clickCount: 3 });
    await userEl.type(username, { delay: 50 });
    await passEl.click({ clickCount: 3 });
    await passEl.type(password, { delay: 50 });

    // Try to find and click submit button
    const submitSelectors = ["button[type='submit']","button#login","button[aria-label='login']","button"];
    let clicked = false;
    for (const sel of submitSelectors) {
      const btn = await page.$(sel);
      if (!btn) continue;
      const txt = (await page.evaluate(el => el.innerText || el.textContent, btn)).toLowerCase();
      // prefer buttons with login text
      if (txt.includes('log') || txt.includes('sign') || sel === "button[type='submit']") {
        await btn.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      // fallback: press Enter while focused on password
      await passEl.press('Enter');
    }

    // wait for either navigation or a token in localStorage
    // page.waitForTimeout may not exist on older puppeteer versions; use a portable delay
    await new Promise((res) => setTimeout(res, 1500));

    // Helper: look for common token keys in localStorage
      // TOKEN_KEYS env can override which storage keys to check (comma-separated)
      const tokenKeysEnv = process.env.TOKEN_KEYS;
      const tokenKeys = tokenKeysEnv ? tokenKeysEnv.split(',').map(s => s.trim()).filter(Boolean) : ['token','jwt','accessToken','authToken','authorization'];

      const token = await page.evaluate((keys) => {
        try {
          // helper to scan an object-like storage (localStorage/sessionStorage)
          const scanStorage = (storage) => {
            if (!storage) return null;
            for (const k of keys) {
              try {
                const v = storage.getItem(k);
                if (v) return v;
              } catch (e) {}
            }
            for (let i = 0; i < storage.length; i++) {
              const key = storage.key(i);
              try {
                const val = storage.getItem(key);
                if (typeof val === 'string' && val.split('.').length === 3) return val;
              } catch (e) {}
            }
            return null;
          };

          // check localStorage
          let found = scanStorage(window.localStorage);
          if (found) return found;
          // check sessionStorage
          found = scanStorage(window.sessionStorage);
          if (found) return found;

          // check cookies for common auth cookie names or any JWT-like value
          try {
            const cookies = document.cookie || '';
            if (cookies) {
              const parts = cookies.split(';').map(s => s.trim());
              for (const p of parts) {
                const eq = p.indexOf('=');
                if (eq === -1) continue;
                const v = decodeURIComponent(p.slice(eq + 1));
                if (!v) continue;
                for (const k of keys) {
                  if (p.toLowerCase().startsWith(k.toLowerCase() + '=')) return v;
                }
                if (typeof v === 'string' && v.split('.').length === 3) return v;
              }
            }
          } catch (e) {}

          return null;
        } catch(e) { return null; }
      }, tokenKeys);

    async function writeToken(tok) {
      try {
        if (!tok) return;
        // if TOKEN_OUT is '-' print to stdout instead of writing a file
        if (TOKEN_OUT === '-') {
          // stdout may be captured by CI; keep a short log as well
          process.stdout.write(tok + '\n');
          console.log('Printed token to stdout');
          return;
        }
        // ensure directory exists
        const dir = path.dirname(outPath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(outPath, tok, { encoding: 'utf8' });
        console.log('Wrote token to', outPath);
      } catch (e) {
        console.warn('Could not write token file:', e && e.message ? e.message : e);
      }
    }

    if (token) {
      console.log('UI login succeeded, token length:', token.length);
      console.log('TOKEN:', token);
      await writeToken(token);
      await browser.close();
      process.exit(0);
    }

    // Wait for token up to 10s (login uses async request)
    try {
      await page.waitForFunction(() => {
        try {
          const keys = ['token','jwt','accessToken','authToken','authorization'];
          if (!window.localStorage) return false;
          for (const k of keys) if (!!window.localStorage.getItem(k)) return true;
          for (let i = 0; i < window.localStorage.length; i++) {
            const val = window.localStorage.getItem(window.localStorage.key(i));
            if (typeof val === 'string' && val.split('.').length === 3) return true;
          }
          return false;
        } catch (e) { return false; }
      }, { timeout: UI_WAIT_FOR_TOKEN_MS });
      const t = await page.evaluate(() => {
        const keys = ['token','jwt','accessToken','authToken','authorization'];
        for (const k of keys) {
          const v = window.localStorage.getItem(k);
          if (v) return v;
        }
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          const val = window.localStorage.getItem(key);
          if (typeof val === 'string' && val.split('.').length === 3) return val;
        }
        return null;
      });
      if (t) {
        console.log('UI login succeeded after wait, token length:', t.length);
        console.log('TOKEN:', t);
        await writeToken(t);
        await browser.close();
        process.exit(0);
      }
    } catch (e) {
      // ignore, we'll try other heuristics below
      console.log('No token after wait-for-function');
    }

    // If no token, attempt to detect success by checking for logout link or user indicator
    const loggedIn = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      if (text.includes('logout') || text.includes('sign out') || text.includes('dashboard')) return true;
      return false;
    });

    if (loggedIn) {
      console.log('UI login appears successful (UI indicator found)');
      await browser.close();
      process.exit(0);
    }

    console.log('UI login did not find token or logged-in indicator. Capturing screenshot to scripts/ui-login-fail.png');
    await page.screenshot({ path: 'scripts/ui-login-fail.png', fullPage: true });
    // Dump localStorage keys to help debugging (non-sensitive: keys only)
    try {
      const lsKeys = await page.evaluate(() => {
        try { return Object.keys(window.localStorage || {}).slice(0,50); } catch (e) { return [] }
      });
      const metaPath = path.resolve(process.cwd(), 'scripts/ui-login-localstorage.json');
      fs.writeFileSync(metaPath, JSON.stringify({ keys: lsKeys }, null, 2), { encoding: 'utf8' });
      console.log('Wrote localStorage keys to', metaPath);
    } catch (e) {
      console.warn('Could not write localStorage keys:', e && e.message ? e.message : e);
    }
    await browser.close();
    process.exit(2);
  } catch (err) {
    // Log original error clearly
    console.error('UI login test failed:', err && err.message ? err.message : err);

    // Try to capture a screenshot only if we have a page
    try {
      if (typeof page !== 'undefined' && page) {
        await page.screenshot({ path: 'scripts/ui-login-error.png', fullPage: true });
        console.log('Wrote screenshot scripts/ui-login-error.png');
      }
    } catch (sErr) {
      console.warn('Could not capture screenshot:', sErr && sErr.message ? sErr.message : sErr);
    }

    // Attempt to close browser if it exists; swallow errors to avoid masking original error
    try {
      if (typeof browser !== 'undefined' && browser) {
        await browser.close();
      }
    } catch (cErr) {
      console.warn('Error closing browser during cleanup:', cErr && cErr.message ? cErr.message : cErr);
    }

    process.exit(1);
  }
}

run();
