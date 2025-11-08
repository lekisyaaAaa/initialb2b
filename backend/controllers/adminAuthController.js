const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { fn, col, where, Op } = require('sequelize');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Admin = require('../models/Admin');
const Otp = require('../models/Otp');
const UserSession = require('../models/UserSession');
const { sendPasswordResetEmail } = require('../services/emailService');
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

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getOtpExpiryDate() {
  const customTtl = Number(process.env.ADMIN_OTP_TTL_MS);
  const ttlMs = Number.isFinite(customTtl) && customTtl > 0 ? customTtl : 5 * 60 * 1000;
  return new Date(Date.now() + ttlMs);
}

async function persistOtpLog(email, otp, expiresAt) {
  if (!email || !otp) {
    return;
  }

  try {
    const codeHash = await bcrypt.hash(otp, 10);
    await Otp.create({ email, codeHash, expiresAt });
  } catch (err) {
    console.warn('adminAuthController.persistOtpLog warning', err && err.message ? err.message : err);
  }
}

async function markOtpVerified(email) {
  if (!email) {
    return;
  }

  try {
    const [latestOtp] = await Otp.findAll({
      where: { email },
      order: [['createdAt', 'DESC']],
      limit: 1,
    });

    if (latestOtp && !latestOtp.verifiedAt) {
      await latestOtp.update({ verifiedAt: new Date() });
    }
  } catch (err) {
    console.warn('adminAuthController.markOtpVerified warning', err && err.message ? err.message : err);
  }
}

async function sendOtpEmailToAdmin({ to, otp, expiresAt }) {
  if (!to || !otp) {
    throw new Error('OTP recipient and code are required');
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be configured');
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPortRaw = process.env.SMTP_PORT;
  const smtpSecureRaw = process.env.EMAIL_SECURE;

  const transporterOptions = smtpHost
    ? {
        host: smtpHost,
        port: (() => {
          const parsed = Number(smtpPortRaw);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
        })(),
        secure: typeof smtpSecureRaw === 'string' ? smtpSecureRaw.toLowerCase() === 'true' : false,
      }
    : {
        service: process.env.EMAIL_SERVICE || 'gmail',
      };

  const transporter = nodemailer.createTransport({
    ...transporterOptions,
    auth: {
      user,
      pass,
    },
  });

  const from = process.env.EMAIL_FROM || user;

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'VermiLinks OTP Verification',
    text: `Your OTP code is: ${otp}\n\nThis code expires at ${expiresAt.toISOString()}.`,
  });

  console.info(`OTP sent successfully to ${to}`, { messageId: info && info.messageId ? info.messageId : undefined });
}

async function assignOtpToAdmin(admin, otp, expiresAt) {
  if (!admin) {
    throw new Error('Administrator record is required to assign OTP');
  }

  const hashedOtp = await bcrypt.hash(otp, 10);
  await admin.update({ otpHash: hashedOtp, otpExpiresAt: expiresAt });
}

async function clearAdminOtp(admin) {
  if (!admin) {
    return;
  }

  await admin.update({ otpHash: null, otpExpiresAt: null });
}

function getSessionTtlSeconds() {
  const hoursRaw = Number(process.env.ADMIN_SESSION_TTL_HOURS);
  const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 ? hoursRaw : 2;
  return Math.ceil(hours * 60 * 60);
}

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  try {
    console.log('Admin login attempt for', normalizedEmail ? `'${normalizedEmail}'` : '<missing email>');
  } catch (logErr) {
    // ignore logging issues
  }

  try {
    const admin = await findAdminByEmail(normalizedEmail);
    if (!admin) {
      console.warn('Admin login failed: account not found for', normalizedEmail);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare((password || '').toString(), admin.passwordHash || '');
    if (!passwordMatches) {
      console.warn('Admin login failed: password mismatch for', normalizedEmail);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const otp = generateOtpCode();
    const expiresAt = getOtpExpiryDate();

    await assignOtpToAdmin(admin, otp, expiresAt);
    await persistOtpLog(admin.email, otp, expiresAt);

    try {
      await sendOtpEmailToAdmin({ to: admin.email, otp, expiresAt });
    } catch (emailErr) {
      console.error('adminAuthController: failed to send OTP email', emailErr && emailErr.message ? emailErr.message : emailErr);

      const isProduction = (process.env.NODE_ENV || 'development') === 'production';
      if (!isProduction) {
        return res.json({
          success: true,
          message: 'Verification code generated (email delivery failed; see debugCode).',
          data: {
            requires2FA: true,
            expiresAt: expiresAt.toISOString(),
            debugCode: otp,
            delivery: 'email_failed',
          },
        });
      }

      await clearAdminOtp(admin);
      return res.status(500).json({ success: false, message: 'Failed to deliver verification code. Please try again.' });
    }

    console.info('Admin OTP issued and email dispatched', { email: admin.email, expiresAt: expiresAt.toISOString() });

    return res.json({
      success: true,
      message: 'Verification code sent to email',
      data: {
        requires2FA: true,
        expiresAt: expiresAt.toISOString(),
        delivery: 'email',
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

  const normalizedEmail = normalizeEmail(req.body.email);
  const submittedOtp = (req.body.otp || '').toString().trim();

  try {
    const admin = await findAdminByEmail(normalizedEmail);
    if (!admin || !admin.otpHash || !admin.otpExpiresAt) {
      return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    }

    const isExpired = new Date(admin.otpExpiresAt).getTime() < Date.now();
    if (isExpired) {
      await clearAdminOtp(admin);
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
    }

    const otpMatches = await bcrypt.compare(submittedOtp, admin.otpHash);
    if (!otpMatches) {
      return res.status(401).json({ success: false, message: 'Verification code is incorrect.' });
    }

    const sessionTtlSeconds = getSessionTtlSeconds();
    const tokenExpiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);

    const payload = {
      id: admin.id,
      email: admin.email,
      role: 'admin',
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: sessionTtlSeconds });

    await clearAdminOtp(admin);
    await markOtpVerified(admin.email);

    try {
      await UserSession.create({
        adminId: admin.id,
        token,
        expiresAt: tokenExpiresAt,
        metadata: {
          ip: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
        },
      });
    } catch (sessionErr) {
      console.warn('adminAuthController.verifyOtp failed to persist session', sessionErr && sessionErr.message ? sessionErr.message : sessionErr);
    }

    console.info('Admin OTP verified and session issued', { email: admin.email, sessionExpiresAt: tokenExpiresAt.toISOString() });

    return res.json({
      success: true,
      message: 'Authentication complete',
      data: {
        token,
        expiresAt: tokenExpiresAt.toISOString(),
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

  const normalizedEmail = normalizeEmail(req.body.email);

  try {
    const admin = await findAdminByEmail(normalizedEmail);

    if (!admin) {
      // Do not reveal whether the account exists.
      return res.json({ success: true, message: 'If the account exists, a new verification code has been sent.' });
    }

    const otp = generateOtpCode();
    const expiresAt = getOtpExpiryDate();

    await assignOtpToAdmin(admin, otp, expiresAt);
    await persistOtpLog(admin.email, otp, expiresAt);

    try {
      await sendOtpEmailToAdmin({ to: admin.email, otp, expiresAt });
    } catch (emailErr) {
      console.error('adminAuthController: failed to resend OTP email', emailErr && emailErr.message ? emailErr.message : emailErr);

      const isProduction = (process.env.NODE_ENV || 'development') === 'production';
      if (!isProduction) {
        return res.json({
          success: true,
          message: 'Verification code generated (email delivery failed; see debugCode).',
          data: {
            expiresAt: expiresAt.toISOString(),
            debugCode: otp,
            delivery: 'email_failed',
          },
        });
      }

      await clearAdminOtp(admin);
      return res.status(500).json({ success: false, message: 'Unable to resend verification code. Please try again.' });
    }

    console.info('Admin OTP re-issued and email dispatched', { email: admin.email, expiresAt: expiresAt.toISOString() });

    return res.json({
      success: true,
      message: 'Verification code sent to email',
      data: {
        expiresAt: expiresAt.toISOString(),
        delivery: 'email',
      },
    });
  } catch (err) {
    console.error('adminAuthController.resendOtp error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, message: 'Unable to resend verification code' });
  }
};

exports.getSession = async (req, res) => {
  const authHeader = (req.headers.authorization || '').toString();
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = bearerToken || (req.query && req.query.token ? String(req.query.token).trim() : '') || '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'devsecret';
    const decoded = jwt.verify(token, secret);

    const session = await UserSession.findOne({ where: { token } });
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session is invalid or has been revoked' });
    }

    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      await session.destroy().catch(() => {});
      return res.status(401).json({ success: false, message: 'Session has expired' });
    }

    const admin = await Admin.findByPk(decoded.id, {
      attributes: ['id', 'email', 'createdAt', 'updatedAt'],
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Account is unavailable' });
    }

    return res.json({
      success: true,
      data: {
        token,
        expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
        user: {
          id: admin.id,
          email: admin.email,
        },
      },
    });
  } catch (err) {
    console.warn('adminAuthController.getSession error', err && err.message ? err.message : err);
    return res.status(401).json({ success: false, message: 'Session validation failed' });
  }
};
