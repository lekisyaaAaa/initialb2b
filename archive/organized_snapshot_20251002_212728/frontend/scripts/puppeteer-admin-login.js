const puppeteer = require('puppeteer');

async function run(url) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => {
    try { console.log('PAGE:', msg.type(), msg.text()); } catch(e) { /* ignore */ }
  });
  await page.goto(url + '/admin/login', { waitUntil: 'networkidle2', timeout: 15000 });
  await page.type('#username', 'admin');
  await page.type('#password', 'admin');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => null),
  ]);
  // Inspect localStorage to see what the app stored
  const stored = await page.evaluate(() => {
    return {
      token: localStorage.getItem('token'),
      adminToken: localStorage.getItem('adminToken'),
      user: localStorage.getItem('user')
    };
  });
  console.log('Final URL:', page.url());
  console.log('LocalStorage after submit:', stored);
  await browser.close();
}

const argv = require('minimist')(process.argv.slice(2));
const url = argv.url || 'http://127.0.0.1:3002';
run(url).catch(err => { console.error(err); process.exit(1); });
