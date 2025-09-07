// Quick check: ensure SmartBin Console button is hidden for public dashboards
// and visible for admin dashboards after login. Writes a deterministic JSON
// result file and screenshots under the `scripts/` directory so CI / tooling
// can inspect outcomes even if terminal stdout is unavailable.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function check() {
  const url = process.env.URL || 'http://localhost:3002';
  const username = process.env.UI_USERNAME || 'admin';
  const password = process.env.UI_PASSWORD || 'admin';

  const outDir = path.resolve(process.cwd());
  const resultPath = path.join(outDir, 'check-console-visibility.result.json');
  const publicScreenshot = path.join(outDir, 'check-console-visibility-public.png');
  const adminScreenshot = path.join(outDir, 'check-console-visibility-admin.png');
  const errorScreenshot = path.join(outDir, 'check-console-visibility-error.png');

  const launchArgs = ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'];
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  const launchOptions = { args: launchArgs };
  if (chromePath) launchOptions.executablePath = chromePath;

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    page.setDefaultTimeout(parseInt(process.env.UI_TIMEOUT_MS, 10) || 15000);

    // portable sleep helper for Puppeteer versions that may not have waitForTimeout
    const sleep = async (ms) => {
      if (typeof page.waitForTimeout === 'function') return page.waitForTimeout(ms);
      if (typeof page.waitFor === 'function') return page.waitFor(ms);
      return new Promise((r) => setTimeout(r, ms));
    };

    const result = { url, publicHas: false, adminHas: false, errors: [] };

    // 1) Public access
    try {
  await page.goto(url + '/admin/dashboard', { waitUntil: 'networkidle2' });
  await sleep(700);
      const publicEl = await page.$('#btn-home-assistant');
      result.publicHas = !!publicEl;
      await page.screenshot({ path: publicScreenshot, fullPage: true }).catch(()=>{});
    } catch (e) {
      result.errors.push('public-phase:' + (e && e.message ? e.message : String(e)));
      try { await page.screenshot({ path: errorScreenshot, fullPage: true }); } catch(e){}
    }

    // 2) Login as admin
    try {
  await page.goto(url + '/admin/login', { waitUntil: 'networkidle2' });
  await sleep(500);

      // prefer named selectors, fall back to first two inputs
      const userSel = await page.$('#username, input[name="username"]');
      const passSel = await page.$('#password, input[name="password"]');
      if (!userSel || !passSel) {
        const inputs = await page.$$('input');
        if (inputs.length >= 2) {
          await inputs[0].click({ clickCount: 3 });
          await inputs[0].type(username, { delay: 20 });
          await inputs[1].click({ clickCount: 3 });
          await inputs[1].type(password, { delay: 20 });
        } else {
          throw new Error('login inputs not found');
        }
      } else {
        await userSel.click({ clickCount: 3 });
        await userSel.type(username, { delay: 20 });
        await passSel.click({ clickCount: 3 });
        await passSel.type(password, { delay: 20 });
      }

      // try submit buttons
      const submit = await page.$("button[type='submit'], button#login, button[aria-label='login']");
      if (submit) await submit.click(); else await page.keyboard.press('Enter');

      // wait for token or UI change
      try {
        await page.waitForFunction(() => {
          try { return !!(window.localStorage && (window.localStorage.getItem('token') || window.localStorage.getItem('jwt') || window.localStorage.getItem('accessToken'))); } catch(e) { return false; }
        }, { timeout: parseInt(process.env.UI_WAIT_FOR_TOKEN_MS,10) || 10000 });
      } catch (e) {
        // continue, may still be logged in via UI
      }

  await page.goto(url + '/admin/dashboard', { waitUntil: 'networkidle2' });
  await sleep(700);
      const adminEl = await page.$('#btn-home-assistant');
      result.adminHas = !!adminEl;
      await page.screenshot({ path: adminScreenshot, fullPage: true }).catch(()=>{});
    } catch (e) {
      result.errors.push('login-phase:' + (e && e.message ? e.message : String(e)));
      try { await page.screenshot({ path: errorScreenshot, fullPage: true }); } catch(e){}
    }

    // Write result file
    try {
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), { encoding: 'utf8' });
    } catch (e) {
      console.error('Could not write result file:', e && e.message ? e.message : e);
    }

    await browser.close();

    // Exit codes: 0 OK if public hidden and admin visible, otherwise 2
    if (!result.publicHas && result.adminHas) process.exit(0);
    process.exit(2);
  } catch (err) {
    try { if (browser) await browser.close(); } catch (e) {}
    const result = { url, publicHas: false, adminHas: false, errors: [(err && err.message) || String(err)] };
    try { fs.writeFileSync(path.join(process.cwd(), 'check-console-visibility.result.json'), JSON.stringify(result, null, 2), { encoding: 'utf8' }); } catch (e) {}
    console.error('CHECK ERROR:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

check();
