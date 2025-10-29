const axios = require('axios');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT = parseInt(process.env.ESP32_COMMAND_TIMEOUT_MS || '5000', 10);

async function postCommandOnce(url, payload, timeout) {
  return axios.post(url, payload, { timeout });
}

async function sendCommand(actuatorName, action, metadata = {}) {
  const baseUrl = (process.env.ESP32_URL || '').trim();
  if (!baseUrl) {
    const error = new Error('ESP32_URL environment variable is not configured');
    logger.error('[ESP32] Configuration error:', error.message);
    throw error;
  }

  const timeout = Number.isFinite(DEFAULT_TIMEOUT) && DEFAULT_TIMEOUT > 0 ? DEFAULT_TIMEOUT : 5000;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/command`;
  const payload = {
    actuator: actuatorName,
    command: action,
    issuedAt: new Date().toISOString(),
    ...metadata,
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await postCommandOnce(endpoint, payload, timeout);
      logger.info('[ACTUATOR → ESP32]', {
        actuator: actuatorName,
        action,
        status: response.status,
        timestamp: new Date().toISOString(),
      });
      return response.data;
    } catch (err) {
      const attemptLabel = `attempt ${attempt}`;
      const message = err && err.message ? err.message : String(err);
      const status = err && err.response ? err.response.status : 'N/A';
      logger.warn('[ACTUATOR → ESP32] command failed', {
        actuator: actuatorName,
        action,
        attempt: attemptLabel,
        status,
        message,
        timestamp: new Date().toISOString(),
      });
      if (attempt === 2) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error('Unreachable code');
}

module.exports = { sendCommand };
