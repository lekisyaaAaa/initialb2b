const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      console.warn('Admin login: missing username or password');
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const adminUser = process.env.LOCAL_ADMIN_USER || 'admin';
    const adminPass = process.env.LOCAL_ADMIN_PASS || 'admin';

    if (username === adminUser && password === adminPass) {
      const payload = { id: 'admin-local', username: adminUser, role: 'admin' };
      const secret = process.env.JWT_SECRET || 'devsecret';
      const token = jwt.sign(payload, secret, { expiresIn: '24h' });
      console.log('Admin login: success for', username);
      return res.json({ success: true, token });
    }

    console.warn('Admin login: invalid credentials for', username);
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  } catch (err) {
    console.error('Admin login: server error', err && (err.message || err));
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
