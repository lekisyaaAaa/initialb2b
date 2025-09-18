const puppeteer = require('puppeteer');
const url = process.argv[2] || 'http://127.0.0.1:3002/contact';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  const html = await page.$eval('.container', el => el.innerHTML);
  console.log(html.slice(0, 2000));
  await browser.close();
})();
