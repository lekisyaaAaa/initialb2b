const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;

// Simple logger helper
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// Global handlers to avoid silent crashes and log useful diagnostics
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason && reason.stack ? reason.stack : reason);
});

// Health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve static files if build exists
const buildPath = path.join(__dirname, 'build');
const indexFile = path.join(buildPath, 'index.html');

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  log('Serving static files from:', buildPath);
} else {
  log('Warning: build directory not found at', buildPath);
}

// Handle WebSocket requests gracefully (some clients probe /ws)
app.get('/ws', (req, res) => {
  res.status(404).json({ error: 'WebSocket endpoint not available' });
});

// Client-side routing: send index.html for non-API, non-static requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) return next();

  if (!fs.existsSync(indexFile)) {
    log('index.html not found at', indexFile);
    return res.status(501).send('<h1>Frontend not built</h1><p>Run <code>npm run build</code> in the frontend directory.</p>');
  }

  res.sendFile(indexFile, (err) => {
    if (err) {
      console.error('Error sending index.html:', err && err.stack ? err.stack : err);
      if (!res.headersSent) {
        res.status(err.status || 500).send('Server error while sending index.html');
      }
    }
  });
});

// Basic error logger middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err && err.stack ? err.stack : err);
  if (!res.headersSent) res.status(500).send('Internal Server Error');
});

// Start server
let server;
try {
  server = app.listen(PORT, () => {
    log('Frontend server running on port', PORT);
    log('Access at: http://localhost:' + PORT);
  });

  server.on('error', (err) => {
    console.error('Server error:', err && err.stack ? err.stack : err);
  });
} catch (err) {
  console.error('Failed to start server:', err && err.stack ? err.stack : err);
}

