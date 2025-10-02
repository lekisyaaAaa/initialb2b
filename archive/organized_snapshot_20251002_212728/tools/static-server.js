const http = require('http');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', 'frontend', 'build');
const port = process.env.PORT || 3002;
const host = process.env.HOST || '127.0.0.1';

const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(root, reqPath);
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // fallback to index.html for SPA routes
      const index = path.join(root, 'index.html');
      fs.readFile(index, (e, data) => {
        if (e) { res.writeHead(500); res.end('Server error'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(filePath);
    const ct = mime[ext] || 'application/octet-stream';
    fs.createReadStream(filePath).pipe(res).on('open', () => res.writeHead(200, { 'Content-Type': ct }));
  });
});

server.listen(port, host, () => console.log('Static server listening on http://' + host + ':' + port));

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
