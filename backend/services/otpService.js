const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const AdminOTP = require('../models/AdminOTP');

const OTP_LENGTH = 6;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // five minutes
const DEFAULT_MAX_ATTEMPTS = 5;

function getTtlMs() {
  const parsed = Number(process.env.ADMIN_OTP_TTL_MS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_TTL_MS;
}

function getMaxAttempts() {
  const parsed = Number(process.env.ADMIN_OTP_MAX_ATTEMPTS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_ATTEMPTS;
}

function generateOtpCode() {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  const code = Math.floor(min + Math.random() * (max - min + 1));
  return String(code);
}

async function pruneExpiredOtps(adminId) {
  try {
    await AdminOTP.update(
      { consumed: true, consumedAt: new Date() },
      {
        where: {
          adminId,
          consumed: false,
          expiresAt: {
            [Op.lt]: new Date(),
          },
        },
      },
    );
  } catch (err) {
    console.warn('otpService: failed to prune expired entries', err && err.message ? err.message : err);
  }
}

async function issueOtp(adminId) {
  if (!adminId) {
    throw new Error('adminId is required to issue OTP');
  }

  await pruneExpiredOtps(adminId);

  // Invalidate previous unused OTPs to enforce single-use flow.
  await AdminOTP.update(
    { consumed: true, consumedAt: new Date() },
    {
      where: {
        adminId,
        consumed: false,
      },
    },
  );

  const code = generateOtpCode();
  const otpHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + getTtlMs());

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    console.log(`otpService: issued OTP ${code} for adminId=${adminId}, expiresAt=${expiresAt.toISOString()}`);
  }

  const entry = await AdminOTP.create({
    adminId,
    otpHash,
    expiresAt,
  });

  return { code, expiresAt, entry };
}

async function verifyOtp(adminId, code) {
  if (!adminId || !code) {
    return { valid: false, reason: 'missing_parameters' };
  }

  const otpRecord = await AdminOTP.findOne({
    where: {
      adminId,
      consumed: false,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!otpRecord) {
    return { valid: false, reason: 'not_found' };
  }

  if (otpRecord.expiresAt && new Date(otpRecord.expiresAt).getTime() < Date.now()) {
    otpRecord.consumed = true;
    otpRecord.consumedAt = new Date();
    await otpRecord.save();
    return { valid: false, reason: 'expired' };
  }

  const matches = await bcrypt.compare(code, otpRecord.otpHash);
  if (!matches) {
    otpRecord.attempts += 1;
    const maxAttempts = getMaxAttempts();
    if (otpRecord.attempts >= maxAttempts) {
      otpRecord.consumed = true;
      otpRecord.consumedAt = new Date();
    }
    await otpRecord.save();
    const attemptsRemaining = Math.max(0, getMaxAttempts() - otpRecord.attempts);
    return { valid: false, reason: 'mismatch', attemptsRemaining };
  }

  otpRecord.consumed = true;
  otpRecord.consumedAt = new Date();
  await otpRecord.save();
  return { valid: true, otp: otpRecord };
}

module.exports = {
  issueOtp,
  verifyOtp,
  pruneExpiredOtps,
};
