const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const nodemailer = require('nodemailer');

async function main() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.error('EMAIL_USER and EMAIL_PASS must be configured before running scripts/test-email.js');
    process.exit(1);
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

  const target = process.env.EMAIL_TEST_TO || user;
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || user,
    to: target,
    subject: 'VermiLinks SMTP test',
    text: 'This is a verification email sent by scripts/test-email.js to confirm SMTP credentials.',
  });

  console.log('Email dispatched', {
    to: target,
    messageId: info && info.messageId ? info.messageId : undefined,
    response: info && info.response ? info.response : undefined,
  });

  try {
    if (typeof transporter.close === 'function') {
      transporter.close();
    }
  } catch (e) {
    // ignore
  }
}

main().catch((err) => {
  console.error('Failed to send test email:', err && err.message ? err.message : err);
  process.exit(1);
});
