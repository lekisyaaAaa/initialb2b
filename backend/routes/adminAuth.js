const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const adminAuthController = require('../controllers/adminAuthController');

const router = express.Router();

const normalizeEmail = (value) => (value || '').toString().trim().toLowerCase();
const rateLimitKey = (req) => `${req.ip || req.connection?.remoteAddress || 'unknown'}:${normalizeEmail(req.body && req.body.email)}`;

const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.ADMIN_LOGIN_RATE_WINDOW_MS || (15 * 60 * 1000).toString(), 10),
  max: parseInt(process.env.ADMIN_LOGIN_RATE_MAX || '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait before trying again.',
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: parseInt(process.env.ADMIN_OTP_RATE_WINDOW_MS || (15 * 60 * 1000).toString(), 10),
  max: parseInt(process.env.ADMIN_OTP_RATE_MAX || '25', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait before trying again.',
  },
});

const otpResendLimiter = rateLimit({
  windowMs: parseInt(process.env.ADMIN_OTP_RESEND_RATE_WINDOW_MS || (15 * 60 * 1000).toString(), 10),
  max: parseInt(process.env.ADMIN_OTP_RESEND_RATE_MAX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: {
    success: false,
    message: 'Too many resend attempts. Please try again later.',
  },
});

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  adminAuthController.login,
);

router.post(
  '/verify-otp',
  otpVerifyLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be a 6-digit code'),
  ],
  adminAuthController.verifyOtp,
);

router.post(
  '/resend-otp',
  otpResendLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
  ],
  adminAuthController.resendOtp,
);

router.post(
  '/forgot-password',
  [
    body('email').isEmail().withMessage('A valid email is required'),
  ],
  adminAuthController.forgotPassword,
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
  ],
  adminAuthController.resetPassword,
);

router.get('/session', adminAuthController.getSession);
router.post(
  '/refresh',
  [
    body('refreshToken').isString().isLength({ min: 20 }).withMessage('Refresh token is required'),
  ],
  adminAuthController.refreshSession,
);

router.post(
  '/logout',
  [
    body('refreshToken').optional().isString().withMessage('Refresh token must be a string'),
    body('token').optional().isString().withMessage('Token must be a string'),
  ],
  adminAuthController.logout,
);

module.exports = router;
