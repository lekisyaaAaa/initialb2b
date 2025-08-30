const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3002;
app.use(express.static(path.join(__dirname, 'build')));
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`Static server running on http://${host}:${port}`);
  console.log('Note: if host is 0.0.0.0, use your machine IP to access from other devices');
});
