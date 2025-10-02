const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000/contact';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const result = await page.evaluate(() => {
    const body = document.body;
    const header = document.querySelector('header.admin-fixed') || document.querySelector('header');
    const computedBody = window.getComputedStyle(body).paddingTop;
    const hasClass = body.classList.contains('has-admin-header');
    const headerStyle = header ? window.getComputedStyle(header) : null;
    return {
      url: location.href,
      bodyPaddingTop: computedBody,
      hasAdminClass: hasClass,
      headerExists: !!header,
      headerPosition: headerStyle ? headerStyle.position : null,
      headerTop: headerStyle ? headerStyle.top : null,
      headerZ: headerStyle ? headerStyle.zIndex : null
    };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();