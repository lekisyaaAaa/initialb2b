const puppeteer = require('puppeteer');
const url = process.argv[2] || 'http://127.0.0.1:3002/contact';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: 'screenshots/contact-desktop-new.png', fullPage: false });
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: 'screenshots/contact-mobile-new.png', fullPage: false });
  await browser.close();
  console.log('screenshots saved');
})();
