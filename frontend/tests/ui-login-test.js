const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const buildPort = process.env.PORT || process.env.FRONTEND_PORT || '3003';
  const buildServer = process.env.FRONTEND_URL || `http://127.0.0.1:${buildPort}`;
  const screenshotDir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  try {
    console.log('Opening', buildServer);
    await page.goto(buildServer, { waitUntil: 'networkidle2' });

    // Click admin login link
    await page.waitForSelector('a[href="/admin/login"], a:has-text("Admin Login"), a:has-text("Admin Access")', { timeout: 5000 }).catch(() => {});
    // Attempt multiple ways to find the button/link
    const link = await page.$('a[href="/admin/login"]') || await page.$x("//a[contains(., 'Admin Login') or contains(., 'Admin Access')]")
    if (!link) {
      console.error('Admin login link not found');
      await page.screenshot({ path: path.join(screenshotDir, 'no-link.png'), fullPage: true });
      await browser.close();
      process.exit(2);
    }

    if (Array.isArray(link)) {
      await link[0].click();
    } else {
      await link.click();
    }

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 });

    // Now we should be on /admin/login
    console.log('Current URL after click:', page.url());
    await page.screenshot({ path: path.join(screenshotDir, 'after-click.png'), fullPage: true });

    // Fill form
    await page.waitForSelector('input[name="username"], #username', { timeout: 5000 });
    await page.type('input[name="username"], #username', process.env.TEST_ADMIN_USER || 'admin');
    await page.type('input[name="password"], #password', process.env.TEST_ADMIN_PASS || 'admin');

    // Submit
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
    ]);

    const finalUrl = page.url();
    console.log('Final URL after submit:', finalUrl);
    await page.screenshot({ path: path.join(screenshotDir, 'after-submit.png'), fullPage: true });

    // Dump localStorage for debugging
    const localStorageData = await page.evaluate(() => {
      const out = {};
      Object.keys(localStorage).forEach(k => out[k] = localStorage.getItem(k));
      return out;
    });

    const dumpPath = path.join(screenshotDir, 'localStorage.json');
    fs.writeFileSync(dumpPath, JSON.stringify(localStorageData, null, 2));
    console.log('Wrote localStorage to', dumpPath);

    await browser.close();
    console.log('UI login test completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('UI login test failed:', err);
    await page.screenshot({ path: path.join(screenshotDir, 'error.png'), fullPage: true }).catch(() => {});
    await browser.close();
    process.exit(1);
  }
})();
