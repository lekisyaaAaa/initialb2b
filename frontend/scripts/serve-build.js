const express = require('express');
const path = require('path');

const app = express();
const DEFAULT_PORT = 3002;
const buildDir = path.join(__dirname, '..', 'build');

if (!require('fs').existsSync(buildDir)) {
  console.error(`Build directory not found at ${buildDir}. Please run 'npm run build' in the frontend folder.`);
  process.exit(2);
}

app.use(express.static(buildDir));

// Fallback for client-side routing: return index.html for any path not matching static assets
app.get('*', (req, res) => {
  const indexPath = path.join(buildDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err.message);
      res.status(500).send('Frontend build not found. Please run `npm run build` in the frontend folder.');
    }
  });
});

function tryListen(port, attemptsLeft, triedPorts) {
  const bindAddr = '0.0.0.0';
  const server = app.listen(port, bindAddr, () => {
    console.log(`Serving frontend build from ${buildDir} on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      triedPorts.push(port);
      console.warn(`Port ${port} in use. ${attemptsLeft - 1} attempts left. Trying next port...`);
      try {
        server.close();
      } catch (e) {}
      if (attemptsLeft > 1) {
        return tryListen(port + 1, attemptsLeft - 1, triedPorts);
      }
      console.error('All port attempts failed. Tried:', triedPorts.join(', '));
      process.exit(1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  // graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down static server');
    server.close(() => process.exit(0));
  });
}

const requestedPort = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
tryListen(requestedPort, 10, []);
