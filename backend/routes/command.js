const express = require('express');

const router = express.Router();

// Legacy actuator command surface retired. These APIs now return HTTP 410 to steer
// clients toward the Home Assistant workflow for device control.
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Actuator commands are no longer handled by the backend. Use Home Assistant instead.',
    code: 'command_deprecated',
  });
});

module.exports = router;
