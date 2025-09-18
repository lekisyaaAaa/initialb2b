const puppeteer = require('puppeteer');

const url = process.env.URL || 'http://127.0.0.1:3002/test-ws-client.html';

(async () => {
  console.log('Launching headless browser to load', url);
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    console.log('PAGE LOG:', text);
  });

  // Capture network requests; note: Puppeteer does not expose WS frames directly, but we can see WS upgrade request
  page.on('request', req => {
    if (req.resourceType() === 'other' || req.url().startsWith('ws://') || req.url().startsWith('wss://')) {
      console.log('Network request:', req.method(), req.url(), req.resourceType());
    }
  });

  page.on('response', async res => {
    try {
      const req = res.request();
      if (req.resourceType() === 'other' || req.url().startsWith('http://127.0.0.1:3002') || req.url().startsWith('http://localhost:3002')) {
        console.log('Response:', req.method(), req.url(), res.status());
      }
    } catch (e) {}
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    // Click the test button if present
    const btn = await page.$('button');
    if (btn) {
      console.log('Clicking test button on page...');
      await btn.click();
      // small sleep for compatibility
      await new Promise(r => setTimeout(r, 1500));
    } else {
      console.log('No test button found on page.');
    }

    // Print any page content in #result
    const result = await page.$eval('#result', el => el.innerText).catch(() => null);
    console.log('Page #result:', result);
  } catch (err) {
    console.error('Error loading page:', err && err.message ? err.message : err);
    await browser.close();
    process.exit(2);
  }

  await browser.close();
  process.exit(0);
})();
