const puppeteer = require('puppeteer');

async function run(url) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url + '/admin/login', { waitUntil: 'networkidle2', timeout: 20000 });

  const resp = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'beantobin', password: 'Bean2bin' }) });
      const txt = await r.text();
      return { status: r.status, body: txt };
    } catch (e) {
      return { error: String(e) };
    }
  });

  console.log('Fetch result from page context:', resp);
  await browser.close();
}

const argv = require('minimist')(process.argv.slice(2));
const url = argv.url || 'http://127.0.0.1:5000';
run(url).catch(err => { console.error(err); process.exit(1); });
