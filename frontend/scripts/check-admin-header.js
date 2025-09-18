const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:3002/admin/dashboard';
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  // Wait for the admin header to render (site-title is inside header)
  await page.waitForSelector('.site-title', { timeout: 10000 }).catch(() => null);

  const info = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('header'));
    const info = headers.map(h => {
      const style = window.getComputedStyle(h);
      const rect = h.getBoundingClientRect();
      // collect ancestor chain styles for common stacking-context properties
      const ancestors = [];
      let cur = h.parentElement;
      while (cur) {
        const s = window.getComputedStyle(cur);
        ancestors.push({ tag: cur.tagName.toLowerCase(), id: cur.id || null, className: cur.className || null, transform: s.transform, filter: s.filter, perspective: s.perspective, willChange: s.willChange, position: s.position, zIndex: s.zIndex });
        cur = cur.parentElement;
      }

      return {
        outerHTMLLength: h.outerHTML ? h.outerHTML.length : 0,
        position: style.position,
        top: style.top,
        zIndex: style.zIndex,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        ancestors
      };
    });
    // scroll to test movement
    window.scrollTo({ top: 400, behavior: 'auto' });
    const headersAfter = Array.from(document.querySelectorAll('header')).map(h => ({ top: h.getBoundingClientRect().top }));
    return { headersCount: headers.length, headers: info, headersAfter, finalUrl: location.href, bodyLength: document.body ? document.body.innerHTML.length : 0 };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
