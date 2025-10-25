const requiredKeys = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'EMAIL_FROM',
  'CORS_ORIGIN',
  'ESP32_URL',
];

function validateEnv() {
  const missing = requiredKeys.filter((key) => !process.env[key] || String(process.env[key]).trim().length === 0);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('   Please update your environment configuration before starting the server.');
    process.exit(1);
  }
}

module.exports = {
  validateEnv,
  requiredKeys,
};
