const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { username, password } = req.body;

    // Attempt DB lookup; if DB is down allow an explicit local-admin fallback
    let user;
    try {
      user = await User.findOne({ where: { username } });
    } catch (dbErr) {
      const msg = (dbErr && (dbErr.message || dbErr.toString()) || '').toLowerCase();
      if (msg.includes('econnrefused') || msg.includes('connectionrefused') || (dbErr && dbErr.parent && dbErr.parent.code === 'ECONNREFUSED')) {
        if (process.env.ENABLE_LOCAL_ADMIN === 'true') {
          const localUser = process.env.LOCAL_ADMIN_USER || 'admin';
          const localPass = process.env.LOCAL_ADMIN_PASS || 'admin123';
          if (username === localUser && password === localPass) {
            const payload = { id: 'local-admin', username: localUser, role: 'admin' };
            const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '24h' });
            return res.json({ success: true, message: 'Login successful (local admin)', data: { token, user: { id: payload.id, username: payload.username, role: payload.role } } });
          }
        }

        return res.status(503).json({ success: false, message: 'Database unavailable. Check PostgreSQL and DATABASE_URL.' });
      }
      throw dbErr;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // If the model uses isActive check, treat undefined as active
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Non-fatal updates
    try {
      const updateFields = {};
      if ('lastLogin' in user) updateFields.lastLogin = new Date();
      if ('loginCount' in user) updateFields.loginCount = (user.loginCount || 0) + 1;
      if (Object.keys(updateFields).length) await user.update(updateFields);
    } catch (e) {
      console.warn('Could not update lastLogin/loginCount:', e && e.message ? e.message : e);
    }

    const payload = { id: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ success: true, message: 'Login successful', data: { token, user: { id: user.id, username: user.username, role: user.role, lastLogin: user.lastLogin || null, loginCount: user.loginCount || 0 } } });

  } catch (error) {
    const emsg = (error && (error.message || error.toString()) || '').toLowerCase();
    if (emsg.includes('econnrefused') || emsg.includes('connectionrefused') || (error && error.parent && error.parent.code === 'ECONNREFUSED')) {
      console.error('Login DB connection error (ECONNREFUSED):', error && (error.message || error));
      return res.status(503).json({ success: false, message: 'Database unavailable. Check PostgreSQL and DATABASE_URL.' });
    }

    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Logout (no-op server-side)
router.post('/logout', (req, res) => res.json({ success: true, message: 'Logged out successfully' }));

// Get current user
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user: { id: user.id, username: user.username, role: user.role, lastLogin: user.lastLogin || null, loginCount: user.loginCount || 0 } } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify token
router.post('/verify-token', require('../middleware/auth').auth, (req, res) => res.json({ success: true, message: 'Token is valid', data: { user: { id: req.user.id, username: req.user.username, role: req.user.role } } }));

module.exports = router;
