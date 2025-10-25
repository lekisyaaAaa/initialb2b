const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required to send email.');
  }

  const service = (process.env.EMAIL_SERVICE || '').trim().toLowerCase();
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const portValue = process.env.EMAIL_PORT || process.env.SMTP_PORT;
  const port = portValue ? Number(portValue) : undefined;
  const secureFlag = (() => {
    const raw = (process.env.EMAIL_SECURE || '').trim().toLowerCase();
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return undefined;
  })();

  if (host) {
    transporter = nodemailer.createTransport({
      host,
      port: port ?? 587,
      secure: secureFlag ?? false,
      auth: {
        user,
        pass,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      service: service || 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  return transporter;
}

function getFrontendBaseUrl() {
  const raw = typeof process.env.FRONTEND_URL === 'string' && process.env.FRONTEND_URL.trim().length > 0
    ? process.env.FRONTEND_URL.trim()
    : 'http://localhost:3002';
  return raw.replace(/\/$/, '');
}

async function sendOtpEmail({ to, code, expiresAt }) {
  const transporterInstance = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const expiryLabel = expiresAt instanceof Date ? expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '5 minutes';
  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Your BeanToBin admin verification code',
    text: `Use the following one-time code to finish signing in: ${code}.\n\nThis code expires at ${expiryLabel}.\nIf you did not initiate this request, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">BeanToBin Admin Verification</h2>
        <p>Use the following one-time code to finish signing in:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>This code expires at <strong>${expiryLabel}</strong>.</p>
        <p>If you did not request this code, you can safely ignore this email.</p>
      </div>
    `,
  };

  const info = await transporterInstance.sendMail(mailOptions);
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    console.log(`emailService: OTP email queued with id ${info.messageId}`);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log(`emailService: preview URL ${preview}`);
    }
  }
}

async function sendPasswordResetEmail({ to, token }) {
  const transporterInstance = getTransporter();
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const resetLink = `${getFrontendBaseUrl()}/admin/reset-password?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Reset your BeanToBin admin password',
    text: `We received a request to reset your password.\n\nUse the link below to choose a new password (expires in 15 minutes):\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="margin-bottom: 12px;">BeanToBin Password Reset</h2>
        <p>We received a request to reset your admin account password.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#1769aa;color:#fff;text-decoration:none;border-radius:4px;">Reset Password</a>
        </p>
        <p>This link expires in <strong>15 minutes</strong>. If you did not request a reset, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #666;">If the button does not work, copy and paste this URL into your browser:<br />${resetLink}</p>
      </div>
    `,
  };

  const info = await transporterInstance.sendMail(mailOptions);
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    console.log(`emailService: reset email queued with id ${info.messageId}`);
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log(`emailService: preview URL ${preview}`);
    }
  }
}

module.exports = {
  getTransporter,
  sendOtpEmail,
  sendPasswordResetEmail,
};
