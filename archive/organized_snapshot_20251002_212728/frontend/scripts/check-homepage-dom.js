const puppeteer = require('puppeteer');

async function run(url = 'http://127.0.0.1:3002') {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url + '/', { waitUntil: 'networkidle2', timeout: 15000 });

  const result = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('.feature-card h3')).map(n => n.textContent.trim());
    return {
      featureCardCount: document.querySelectorAll('.feature-card').length,
      badgeCount: document.querySelectorAll('.feature-icon-badge').length,
      glowCount: document.querySelectorAll('.card-edge-glow').length,
      titles,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

run(process.argv[2] || undefined).catch(err => { console.error(err); process.exit(1); });
