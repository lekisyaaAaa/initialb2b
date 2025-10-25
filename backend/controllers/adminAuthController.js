const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { fn, col, where, Op } = require('sequelize');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const { issueOtp, verifyOtp: verifyOtpCode } = require('../services/otpService');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');
const PasswordResetToken = require('../models/PasswordResetToken');

function normalizeEmail(value) {
  return (value || '').toString().trim().toLowerCase();
}

async function findAdminByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  return Admin.findOne({
    where: where(fn('lower', col('email')), normalized),
  });
}

function getPasswordResetExpiryDate() {
  const minutesRaw = parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || '15', 10);
  const minutes = Number.isFinite(minutesRaw) && minutesRaw > 0 ? minutesRaw : 15;
  return new Date(Date.now() + minutes * 60 * 1000);
}

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const admin = await findAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { code, expiresAt, entry } = await issueOtp(admin.id);

    try {
      await sendOtpEmail({ to: admin.email, code, expiresAt });
    } catch (emailErr) {
      console.error('adminAuthController: failed to send OTP email', emailErr && emailErr.message ? emailErr.message : emailErr);

      if ((process.env.NODE_ENV || 'development') !== 'production') {
        return res.json({
          success: true,
          message: 'Verification code generated (email delivery failed; see debugCode).',
          data: {
            requires2FA: true,
            expiresAt: expiresAt.toISOString(),
            debugCode: code,
            delivery: 'email_failed',
          },
        });
      }

      try {
        entry.consumed = true;
        entry.consumedAt = new Date();
        await entry.save();
      } catch (persistErr) {
        console.warn('adminAuthController: failed to invalidate OTP after email error', persistErr && persistErr.message ? persistErr.message : persistErr);
      }

      return res.status(500).json({ success: false, message: 'Failed to deliver verification code. Please try again.' });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to email',
      data: {
        requires2FA: true,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('adminAuthController.login error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Unable to initiate login' });
  }
};

exports.verifyOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email, otp } = req.body;

  try {
    const admin = await findAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    }

    const verification = await verifyOtpCode(admin.id, (otp || '').toString().trim());

    if (!verification.valid) {
      switch (verification.reason) {
        case 'expired':
          return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
        case 'mismatch':
          return res.status(401).json({ success: false, message: 'Verification code is incorrect.', data: { attemptsRemaining: verification.attemptsRemaining } });
        case 'not_found':
          return res.status(400).json({ success: false, message: 'No active verification code found. Please request a new code.' });
        default:
          return res.status(400).json({ success: false, message: 'Unable to validate code. Please try again.' });
      }
    }

    const payload = {
      id: admin.id,
      email: admin.email,
      role: 'admin',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '24h' });

    return res.json({
      success: true,
      message: 'Authentication complete',
      data: {
        token,
        user: {
          id: admin.id,
          email: admin.email,
          role: 'admin',
        },
      },
    });
  } catch (err) {
    console.error('adminAuthController.verifyOtp error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Unable to verify code' });
  }
};

exports.forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const admin = await findAdminByEmail(email);

    if (admin) {
      try {
        await PasswordResetToken.update(
          { used: true, usedAt: new Date() },
          {
            where: {
              userId: admin.id,
              used: false,
            },
          },
        );

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashResetToken(rawToken);
        const expiresAt = getPasswordResetExpiryDate();

        const resetEntry = await PasswordResetToken.create({
          userId: admin.id,
          tokenHash,
          expiresAt,
        });

        try {
          await sendPasswordResetEmail({ to: admin.email, token: rawToken });
        } catch (emailDispatchError) {
          try {
            await resetEntry.update({ used: true, usedAt: new Date() });
          } catch (tokenUpdateErr) {
            console.warn('adminAuthController.forgotPassword failed to invalidate reset token after email failure', tokenUpdateErr && tokenUpdateErr.message ? tokenUpdateErr.message : tokenUpdateErr);
          }
          throw emailDispatchError;
        }
      } catch (emailErr) {
        console.error('adminAuthController.forgotPassword email failure', emailErr && emailErr.message ? emailErr.message : emailErr);
        return res.status(500).json({ success: false, message: 'Unable to send reset instructions. Please try again later.' });
      }
    }

    return res.json({
      success: true,
      message: 'If the account exists, a password reset email has been sent.',
    });
  } catch (err) {
    console.error('adminAuthController.forgotPassword error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Unable to process request' });
  }
};

exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { token, password } = req.body;

  try {
    const hashedToken = hashResetToken(token || '');
    const resetRecord = await PasswordResetToken.findOne({ where: { tokenHash: hashedToken } });

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    if (resetRecord.used) {
      return res.status(400).json({ success: false, message: 'Reset link has already been used.' });
    }

    if (resetRecord.expiresAt && new Date(resetRecord.expiresAt).getTime() < Date.now()) {
      await resetRecord.update({ used: true, usedAt: new Date() });
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    const admin = await Admin.findByPk(resetRecord.userId);
    if (!admin) {
      await resetRecord.update({ used: true, usedAt: new Date() });
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    admin.passwordHash = hashedPassword;
    await admin.save();

    await resetRecord.update({ used: true, usedAt: new Date() });
    await PasswordResetToken.update(
      { used: true, usedAt: new Date() },
      {
        where: {
          userId: admin.id,
          used: false,
          id: {
            [Op.ne]: resetRecord.id,
          },
        },
      },
    );

    return res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('adminAuthController.resetPassword error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Unable to reset password' });
  }
};

exports.resendOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const admin = await findAdminByEmail(email);

    if (!admin) {
      // Do not reveal whether the account exists.
      return res.json({ success: true, message: 'If the account exists, a new verification code has been sent.' });
    }

    const { code, expiresAt, entry } = await issueOtp(admin.id);

    try {
      await sendOtpEmail({ to: admin.email, code, expiresAt });
    } catch (emailErr) {
      console.error('adminAuthController: failed to resend OTP email', emailErr && emailErr.message ? emailErr.message : emailErr);

      if ((process.env.NODE_ENV || 'development') !== 'production') {
        return res.json({
          success: true,
          message: 'Verification code generated (email delivery failed; see debugCode).',
          data: {
            expiresAt: expiresAt.toISOString(),
            debugCode: code,
            delivery: 'email_failed',
          },
        });
      }

      try {
        entry.consumed = true;
        entry.consumedAt = new Date();
        await entry.save();
      } catch (persistErr) {
        console.warn('adminAuthController: failed to invalidate OTP after resend email error', persistErr && persistErr.message ? persistErr.message : persistErr);
      }

      return res.status(500).json({ success: false, message: 'Unable to resend verification code. Please try again.' });
    }

    return res.json({
      success: true,
      message: 'Verification code sent to email',
      data: {
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('adminAuthController.resendOtp error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Unable to resend verification code' });
  }
};
