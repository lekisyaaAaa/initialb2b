const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const { getSystemTests, runSystemTests } = require('../controllers/systemTestController');

router.get('/', auth, adminOnly, getSystemTests);
router.post('/run', auth, adminOnly, runSystemTests);

module.exports = router;
