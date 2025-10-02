const http = require('http');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'frontend', 'build');
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

function safeJoin(base, target) {
  const targetPath = '.' + path.normalize('/' + target);
  return path.join(base, targetPath);
}

const server = http.createServer((req, res) => {
  try {
    let filePath = req.url;
    if (!filePath || filePath === '/') filePath = '/index.html';
    // prevent directory traversal
    const resolved = safeJoin(buildDir, filePath);
    if (!resolved.startsWith(buildDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    let stat;
    try { stat = fs.statSync(resolved); } catch (e) { stat = null; }
    if (!stat || !stat.isFile()) {
      // fallback to index.html for SPA routing
      const index = path.join(buildDir, 'index.html');
      if (fs.existsSync(index)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(index).pipe(res);
        return;
      }
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(resolved).toLowerCase();
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    fs.createReadStream(resolved).pipe(res);
  } catch (err) {
    console.error('Serve error', err);
    try { res.writeHead(500); res.end('Server error'); } catch (e) {}
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Static server serving ${buildDir} on http://127.0.0.1:${port}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down static server');
  server.close(() => process.exit(0));
});
