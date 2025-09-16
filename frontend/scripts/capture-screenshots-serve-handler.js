const { createServer } = require('http');
const handler = require('serve-handler');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const server = createServer((req, res) => handler(req, res, { public: path.join(__dirname, '../build') }));
  server.listen(0, async () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;
    console.log('Serving build at', url);

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const sizes = [
      { name: 'desktop', width: 1366, height: 768 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 812 },
    ];

    for (const s of sizes) {
      await page.setViewport({ width: s.width, height: s.height });
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: `./screenshots/${s.name}.png`, fullPage: true });
      console.log('Captured', s.name);
    }

    await browser.close();
    server.close();
  });
})();
