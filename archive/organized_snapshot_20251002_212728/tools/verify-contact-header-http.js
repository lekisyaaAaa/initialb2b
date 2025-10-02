const http = require('http');
const https = require('https');
const url = require('url');
const { promisify } = require('util');

function fetchText(u) {
  return new Promise((resolve, reject) => {
    const lib = u.startsWith('https') ? https : http;
    lib.get(u, (res) => {
      if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

(async () => {
  const target = process.argv[2] || 'http://127.0.0.1:3002/contact';
  try {
    const html = await fetchText(target);
    // Try to find the main CSS filename in the built index
    const cssMatch = html.match(/href="([^"]+main\.[^"]+\.css)"/);
    if (!cssMatch) {
      console.log(JSON.stringify({ ok: false, reason: 'could not find main css in index.html' }, null, 2));
      process.exit(0);
    }
    const cssPath = cssMatch[1].startsWith('http') ? cssMatch[1] : new URL(cssMatch[1], target).toString();
    const css = await fetchText(cssPath);
    const hasRule = css.includes('body.has-admin-header') || css.includes('.has-admin-header');
    console.log(JSON.stringify({ url: target, cssPath, hasAdminRule: hasRule }, null, 2));
  } catch (e) {
    console.error('Error fetching page or CSS:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
