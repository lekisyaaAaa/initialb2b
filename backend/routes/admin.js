const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const adminDevicePortsController = require('../controllers/adminDevicePortsController');

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      console.warn('Admin login: missing username or password');
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const adminUser = process.env.LOCAL_ADMIN_USER || 'beantobin';
    const adminPass = process.env.LOCAL_ADMIN_PASS || 'Bean2bin';

    if (username === adminUser && password === adminPass) {
      const payload = { id: 'admin-local', username: adminUser, role: 'admin' };
      const secret = process.env.JWT_SECRET || 'devsecret';
      const token = jwt.sign(payload, secret, { expiresIn: '24h' });
      console.log('Admin login: success for', username);
      return res.json({
        success: true,
        token,
        user: {
          id: payload.id,
          username: payload.username,
          role: payload.role,
        },
      });
    }

    console.warn('Admin login: invalid credentials for', username);
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  } catch (err) {
    console.error('Admin login: server error', err && (err.message || err));
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Device port management (admin only)
router.get('/devices/:deviceId/ports/enumerate', auth, adminOnly, adminDevicePortsController.enumerate);
router.get('/devices/:deviceId/ports', auth, adminOnly, adminDevicePortsController.list);
router.post('/devices/:deviceId/ports', auth, adminOnly, adminDevicePortsController.assign);

module.exports = router;
