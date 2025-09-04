const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3002;

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle WebSocket requests gracefully
app.get('/ws', (req, res) => {
  res.status(404).json({ error: 'WebSocket endpoint not available' });
});

// Handle React Router - send all requests to index.html for client-side routing
app.use((req, res, next) => {
  // Skip API routes and static files
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
});
