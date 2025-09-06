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

  // Authentication uses DB-seeded users; no short-circuit fallback here.
  // Debug: log login attempts (username only)
  try { console.log(`Login attempt for username='${username}'`); } catch(e) {}

    // Attempt DB lookup; if DB is down allow an explicit local-admin fallback
    let user;
    try {
      console.log('Auth: looking up user in DB for', username);
      user = await User.findOne({ where: { username } });
      console.log('Auth: DB lookup result for', username, !!user);
    } catch (dbErr) {
      // If DB lookup fails for any reason, allow a development fallback when enabled.
      // This makes local testing robust to different error shapes from Sequelize/pg.
      const allowFallback = (process.env.ENABLE_LOCAL_ADMIN === 'true' || process.env.NODE_ENV !== 'production');
      // Debugging: log DB error and fallback decision so we can see why a request may return 503
      try {
        console.warn('Auth login DB lookup error:', dbErr && (dbErr.message || dbErr.toString() || dbErr));
        console.warn(`Auth login allowFallback=${allowFallback} NODE_ENV=${process.env.NODE_ENV} ENABLE_LOCAL_ADMIN=${process.env.ENABLE_LOCAL_ADMIN}`);
      } catch (logErr) {
        // ignore logging errors
      }
      if (allowFallback) {
        const localUser = process.env.LOCAL_ADMIN_USER || 'admin';
        const localPass = process.env.LOCAL_ADMIN_PASS || 'admin';
        if (username === localUser && password === localPass) {
          const payload = { id: 'local-admin', username: localUser, role: 'admin' };
          const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '24h' });
          return res.json({ success: true, message: 'Login successful (local admin)', data: { token, user: { id: payload.id, username: payload.username, role: payload.role } } });
        }
        // If fallback allowed but credentials don't match, return invalid credentials
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Otherwise return a DB unavailable error
      return res.status(503).json({ success: false, message: 'Database unavailable. Check PostgreSQL and DATABASE_URL.' });
    }

    if (!user) {
      console.warn('Auth: no user found for', username);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // If the model uses isActive check, treat undefined as active
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Auth: password compare for', username, 'result=', isMatch);
    if (!isMatch) {
      console.warn('Auth: password mismatch for', username);
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
  const secret = process.env.JWT_SECRET || 'devsecret';
  const token = jwt.sign(payload, secret, { expiresIn: '24h' });
  try { console.log(`Login successful for user id=${user.id} via DB`); } catch(e) {}

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
// Backwards-compatible verify endpoint used by frontend on startup
router.get('/verify', require('../middleware/auth').auth, (req, res) => {
  return res.json({ success: true, message: 'Token is valid', data: { user: { id: req.user.id, username: req.user.username, role: req.user.role } } });
});

// Deprecated POST verify-token kept for backwards compatibility
router.post('/verify-token', require('../middleware/auth').auth, (req, res) => res.json({ success: true, message: 'Token is valid', data: { user: { id: req.user.id, username: req.user.username, role: req.user.role } } }));

module.exports = router;

// --- Dev-only debug endpoint (disabled by default) ---
// To enable this endpoint for local debugging set ENABLE_DEBUG_USERS=true in your local .env (do NOT enable in production).
try {
  const enableDebugUsers = (process.env.ENABLE_DEBUG_USERS === 'true');
  if (enableDebugUsers && (process.env.NODE_ENV || 'development') !== 'production') {
    router.get('/debug-users', async (req, res) => {
      try {
        const users = await User.findAll({ attributes: ['id', 'username', 'password', 'role'] });
        return res.json({ success: true, data: users.map(u => ({ id: u.id, username: u.username, hasPassword: !!u.password, role: u.role })) });
      } catch (e) {
        return res.status(500).json({ success: false, message: 'Could not list users', error: e && e.message });
      }
    });
  }
} catch (e) {
  // ignore if User is not defined or other issues
}
