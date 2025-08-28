const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3002;
app.use(express.static(path.join(__dirname, 'build')));
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.listen(port, '127.0.0.1', () => {
  console.log(`Static server running on http://127.0.0.1:${port}`);
});
