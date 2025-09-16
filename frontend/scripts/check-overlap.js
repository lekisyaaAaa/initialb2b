const { createServer } = require('http');
const handler = require('serve-handler');
const path = require('path');
const puppeteer = require('puppeteer');

function rectsIntersect(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

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

    const results = [];

    for (const s of sizes) {
      await page.setViewport({ width: s.width, height: s.height });
      await page.goto(url, { waitUntil: 'networkidle2' });
      // gather candidate cards (common wrappers) but ignore nested matches (keep top-most)
      const selector = '.rounded-2xl, .rounded-xl, .p-4';
      const rects = await page.$$eval(selector, (els, selector) => {
        // keep only elements that do not have an ancestor matching the selector
        const topEls = els.filter(e => {
          let parent = e.parentElement;
          while (parent) {
            if (parent.matches && parent.matches(selector)) return false;
            parent = parent.parentElement;
          }
          return true;
        });
        return topEls.map(e => {
          const r = e.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height, html: e.outerHTML.slice(0,200) };
        });
      }, selector);

      // detect overlapping pairs
      const overlaps = [];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (rectsIntersect(rects[i], rects[j])) {
            overlaps.push({ a: rects[i], b: rects[j] });
          }
        }
      }

      results.push({ size: s.name, count: rects.length, overlaps: overlaps.length, overlapsSample: overlaps.slice(0,5) });
    }

    console.log(JSON.stringify(results, null, 2));

    await browser.close();
    server.close();
  });
})();
