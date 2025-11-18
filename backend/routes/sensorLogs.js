const express = require('express');
const sensorLogController = require('../controllers/sensorLogController');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, adminOnly, sensorLogController.list);

module.exports = router;
