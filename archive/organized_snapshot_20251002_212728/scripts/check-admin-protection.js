// Simple headless check: visit /admin/dashboard with cleared localStorage
const puppeteer = require('puppeteer');

(async function main(){
  const url = process.env.UI_BASE || 'http://localhost:3002';
  const target = `${url}/admin/dashboard`;
  const timeout = 15000;

  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    // ensure a clean session -- tolerate environments where localStorage is restricted
    await page.goto('about:blank');
    try {
      await page.evaluate(() => {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.clear();
        } catch (e) {
          // ignore cross-origin or sandboxed access errors
        }
      });
    } catch (e) {
      // Some environments (strict sandboxing) throw SecurityError when touching storage.
      // Log and continue — we still can check the page behavior below.
      console.warn('Warning: could not clear storage before navigation:', e && e.message);
    }

    console.log('Visiting', target);
    await page.goto(target, { waitUntil: 'networkidle2', timeout });

  // Wait a short while for client routing to settle
  // use a portable sleep implementation for older Puppeteer versions
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const urlNow = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText || '');

  // check for username field safely
  const usernameEl = await page.$('#username');
  const hasUsernameField = usernameEl !== null;
    const hasAdminHeading = /Admin Sign In/i.test(bodyText) || /Admin Login/i.test(bodyText);

    if (hasUsernameField || hasAdminHeading || /Sign In - Environmental Monitoring System/i.test(bodyText)) {
      console.log('PROTECTION_OK: admin login required when visiting /admin/dashboard (no token)');
      console.log('final-url:', urlNow);
      process.exit(0);
    }

    console.error('PROTECTION_FAIL: admin dashboard did not present login when unauthenticated');
    console.error('final-url:', urlNow);
    // option: save screenshot
    await page.screenshot({ path: 'scripts/check-admin-protection.fail.png', fullPage: true });
    console.error('Wrote scripts/check-admin-protection.fail.png');
    process.exit(2);
  } catch (err) {
    console.error('ERROR running check-admin-protection:', err && (err.stack || err.message || err));
    process.exit(3);
  } finally {
    if (browser) await browser.close();
  }
})();
