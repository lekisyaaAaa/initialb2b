const express = require('express');

const router = express.Router();

// Device command queue endpoints are retired in dummy mode. Return HTTP 410 for all usage.
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Device command queue endpoints were removed. Coordinate actions through Home Assistant.',
    code: 'device_commands_deprecated',
  });
});

module.exports = router;
