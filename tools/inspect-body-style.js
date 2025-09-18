const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:3002/contact';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e=>{ console.error('goto error', e.message); process.exit(2)});

  const result = await page.evaluate(() => {
    const body = document.body;
    const computed = window.getComputedStyle(body).paddingTop;
    const classList = Array.from(body.classList);
    const matchingRules = [];

    for (const sheet of Array.from(document.styleSheets)) {
      let href = sheet.href || 'inline';
      try {
        const rules = sheet.cssRules || sheet.rules || [];
        for (const r of Array.from(rules)) {
          try {
            const sel = r.selectorText || '';
            if (!sel) continue;
            if (sel.includes('body') || sel.includes('.has-admin-header')) {
              const cssText = r.cssText || '';
              if (cssText.includes('padding-top')) {
                matchingRules.push({ href, selector: sel, cssText });
              }
            }
          } catch (e) { /* ignore per-rule */ }
        }
      } catch (e) {
        matchingRules.push({ href, error: e.message });
      }
    }

    return { url: location.href, computed, classList, matchingRules, bodyOuter: body.outerHTML.slice(0,1000) };
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();