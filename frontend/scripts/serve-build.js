const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DEFAULT_PORT = 3002;
const buildDir = path.join(__dirname, '..', 'build');

if (!fs.existsSync(buildDir)) {
  console.error(`Build directory not found at ${buildDir}. Please run 'npm run build' in the frontend folder.`);
  process.exit(2);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const serveFile = (res, filePath, statusCode = 200) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(statusCode, { 'Content-Type': contentType });
  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('Error streaming file:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal server error');
  });
  stream.pipe(res);
};

const requestHandler = (req, res) => {
  try {
    const host = req.headers.host || 'localhost';
    const requestUrl = new URL(req.url || '/', `http://${host}`);
    let pathname = decodeURIComponent(requestUrl.pathname || '/');

    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    }

    const absolutePath = path.join(buildDir, pathname);
    if (!absolutePath.startsWith(buildDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(absolutePath, (err, stats) => {
      if (!err && stats.isFile()) {
        serveFile(res, absolutePath);
        return;
      }

      const indexPath = path.join(buildDir, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (indexErr || !indexStats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        serveFile(res, indexPath);
      });
    });
  } catch (error) {
    console.error('Request handling error:', error instanceof Error ? error.message : error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  }
};

const startServer = (port, attemptsLeft, triedPorts) => {
  const server = http.createServer(requestHandler);

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && attemptsLeft > 1) {
      triedPorts.push(port);
      console.warn(`Port ${port} in use. ${attemptsLeft - 1} attempts left. Trying next port...`);
      server.close(() => startServer(port + 1, attemptsLeft - 1, triedPorts));
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Serving frontend build from ${buildDir} on http://localhost:${port}`);

    const shutdown = () => {
      if (!server.listening) {
        process.exit(0);
        return;
      }
      console.log('Shutting down static server');
      server.close(() => process.exit(0));
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
};

const requestedPort = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
startServer(requestedPort, 10, []);
