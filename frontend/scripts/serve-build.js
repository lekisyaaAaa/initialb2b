const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;
const buildDir = path.join(__dirname, '..', 'build');

app.use(express.static(buildDir));

app.get(['/', '/admin', '/admin/*', '/login', '/dashboard', '/admin/dashboard'], (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serving frontend build from ${buildDir} on http://localhost:${PORT}`);
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down static server');
  process.exit(0);
});
