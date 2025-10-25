const express = require('express');
const { body } = require('express-validator');
const adminAuthController = require('../controllers/adminAuthController');

const router = express.Router();

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  adminAuthController.login,
);

router.post(
  '/verify-otp',
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be a 6-digit code'),
  ],
  adminAuthController.verifyOtp,
);

router.post(
  '/resend-otp',
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

module.exports = router;
