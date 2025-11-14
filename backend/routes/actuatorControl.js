const express = require('express');

const router = express.Router();

// Actuator control is managed in Home Assistant automations; keep this endpoint dormant.
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Actuator control moved to Home Assistant. This endpoint is no longer available.',
    code: 'actuator_control_deprecated',
  });
});

module.exports = router;
