const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run(url, outdir) {
  if (!outdir) outdir = path.join(__dirname, '..', 'dev-screenshots');
  if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  const pages = [
    { name: 'public', url: url + '/' },
    { name: 'admin', url: url + '/admin/dashboard' },
  ];

  const sizes = [
    { name: 'desktop', width: 1366, height: 768 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  for (const pinfo of pages) {
    for (const s of sizes) {
      await page.setViewport({ width: s.width, height: s.height });
      const target = pinfo.url;
      console.log('Loading', target);
      try {
        await page.goto(target, { waitUntil: 'networkidle2', timeout: 15000 });
        const fname = path.join(outdir, `${pinfo.name}-${s.name}.png`);
        await page.screenshot({ path: fname, fullPage: true });
        console.log('Saved', fname);
      } catch (err) {
        console.error('Failed to capture', target, err.message);
      }
    }
  }

  await browser.close();
}

const argv = require('minimist')(process.argv.slice(2));
const url = argv.url || 'http://127.0.0.1:3002';
const outdir = argv.outdir;
run(url, outdir).catch(err => { console.error(err); process.exit(1); });
