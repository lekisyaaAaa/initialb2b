const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const adminDevicePortsController = require('../controllers/adminDevicePortsController');

// Device port management (admin only)
router.get('/devices/:deviceId/ports/enumerate', auth, adminOnly, adminDevicePortsController.enumerate);
router.get('/devices/:deviceId/ports', auth, adminOnly, adminDevicePortsController.list);
router.post('/devices/:deviceId/ports', auth, adminOnly, adminDevicePortsController.assign);

module.exports = router;
