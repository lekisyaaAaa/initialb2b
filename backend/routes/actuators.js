const express = require('express');

const router = express.Router();

// Legacy actuator API intentionally retired. Direct hardware control now lives in Home Assistant.
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Direct actuator endpoints were retired. Use Home Assistant automations or scripts instead.',
    code: 'actuators_deprecated',
  });
});

module.exports = router;
