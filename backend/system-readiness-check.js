#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');
const chalk = require('chalk');
const { table } = require('table');
const { Client: PgClient } = require('pg');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { io } = require('socket.io-client');
const puppeteer = require('puppeteer');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULTS = {
  backendUrl: 'https://vermilinks-backend.onrender.com',
  frontendUrl: 'https://vermilinks-frontend.onrender.com',
  deviceId: 'ESP32-01',
  adminEmail: 'beantobin2025@gmail.com',
  adminPassword: 'Bean2bin2025',
  otpSubject: 'VermiLinks OTP',
  httpTimeout: 15000,
  wsTimeout: 20000,
  otpPollIntervalMs: 7000,
  otpPollAttempts: 6,
  summarySubject: '✅ VermiLinks System Readiness Report',
  socketPath: '/socket.io',
};

const config = {
  backendUrl: (process.env.VERMILINKS_BACKEND_URL || process.env.BACKEND_URL || DEFAULTS.backendUrl).replace(/\/$/, ''),
  frontendUrl: (process.env.VERMILINKS_FRONTEND_URL || process.env.FRONTEND_URL || DEFAULTS.frontendUrl).replace(/\/$/, ''),
  deviceId: process.env.VERMILINKS_DEVICE_ID || DEFAULTS.deviceId,
  adminEmail: process.env.VERMILINKS_ADMIN_EMAIL || DEFAULTS.adminEmail,
  adminPassword: process.env.VERMILINKS_ADMIN_PASSWORD || DEFAULTS.adminPassword,
  otpSubject: process.env.VERMILINKS_OTP_SUBJECT || process.env.SYSTEM_VERIFY_OTP_SUBJECT || DEFAULTS.otpSubject,
  databaseUrl: process.env.VERMILINKS_DATABASE_URL || process.env.DATABASE_URL || '',
  gmailUser: process.env.VERMILINKS_GMAIL_USER || process.env.GMAIL_USER || process.env.GMAIL_ADDRESS || DEFAULTS.adminEmail,
  gmailAppPassword: process.env.VERMILINKS_GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '',
  gmailHost: process.env.GMAIL_IMAP_HOST || 'imap.gmail.com',
  gmailPort: Number(process.env.GMAIL_IMAP_PORT || 993),
  httpTimeout: Number(process.env.SYSTEM_VERIFY_HTTP_TIMEOUT || DEFAULTS.httpTimeout),
  wsTimeout: Number(process.env.SYSTEM_VERIFY_WS_TIMEOUT || DEFAULTS.wsTimeout),
  otpPollIntervalMs: Number(process.env.SYSTEM_VERIFY_OTP_INTERVAL || DEFAULTS.otpPollIntervalMs),
  otpPollAttempts: Number(process.env.SYSTEM_VERIFY_OTP_ATTEMPTS || DEFAULTS.otpPollAttempts),
  summarySubject: process.env.SYSTEM_VERIFY_REPORT_SUBJECT || DEFAULTS.summarySubject,
  summaryPath: path.join(__dirname, 'system-readiness-report.txt'),
  socketPath: process.env.VERMILINKS_SOCKET_PATH || DEFAULTS.socketPath,
};

config.socketOrigin = process.env.VERMILINKS_SOCKET_ORIGIN
  || process.env.SYSTEM_VERIFY_SOCKET_ORIGIN
  || (() => {
    if (!config.frontendUrl) {
      return undefined;
    }
    try {
      return new URL(config.frontendUrl).origin;
    } catch (error) {
      return config.frontendUrl;
    }
  })();

const statusDisplay = {
  pass: { icon: '✔', color: chalk.green },
  warn: { icon: '⚠', color: chalk.yellow },
  fail: { icon: '✖', color: chalk.red },
};

const summaryRows = [];

const context = {
  config,
  results: [],
  http: null,
  pgClient: null,
  adminToken: null,
  adminUser: null,
  otpCode: null,
  browser: null,
};

const http = axios.create({
  baseURL: config.backendUrl,
  timeout: config.httpTimeout,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((request) => {
  if (context.adminToken && !request.headers.Authorization) {
    request.headers.Authorization = `Bearer ${context.adminToken}`;
  }
  return request;
});

context.http = http;

function recordResult(area, status, notes, suggestion) {
  const safeStatus = status === 'warn' ? 'warn' : (status === 'pass' ? 'pass' : (status === 'fail' ? 'fail' : 'fail'));
  summaryRows.push([area, safeStatus, notes, suggestion || '']);
  context.results.push({ area, status: safeStatus, notes, suggestion });
}

async function ensurePgClient() {
  if (context.pgClient) {
    return context.pgClient;
  }
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }
  const sslRequired = !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(config.databaseUrl);
  const client = new PgClient({
    connectionString: config.databaseUrl,
    ssl: sslRequired ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  context.pgClient = client;
  return client;
}

async function fetchOtpCode() {
  if (!config.gmailAppPassword) {
    throw new Error('Gmail app password not configured');
  }
  const client = new ImapFlow({
    host: config.gmailHost,
    port: config.gmailPort,
    secure: true,
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword,
    },
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    const sinceDate = new Date(Date.now() - 15 * 60 * 1000);

    const normalizedOtpSubject = (config.otpSubject || '').toLowerCase();
    const fallbackKeywords = ['verification code', 'otp', 'two-factor', '2fa'];

    for (let attempt = 0; attempt < config.otpPollAttempts; attempt += 1) {
      const searchCriteria = {
        since: sinceDate,
      };
      const query = await client.search(searchCriteria, { uid: true });
      const sorted = [...query].sort((a, b) => b - a);

      for (const uid of sorted) {
        const message = await client.fetchOne(uid, { source: true, envelope: true, flags: true });
        if (!message || !message.envelope) {
          continue;
        }
        const subject = message.envelope.subject || '';
        const normalizedSubject = subject.toLowerCase();
        const subjectMatches = (
          normalizedOtpSubject && normalizedSubject.includes(normalizedOtpSubject)
        ) || fallbackKeywords.some((keyword) => normalizedSubject.includes(keyword));
        if (!subjectMatches) {
          continue;
        }
        const parsed = await simpleParser(message.source);
        const text = parsed.text || parsed.html || '';
        const match = text.match(/\b(\d{6})\b/);
        if (match) {
          return { code: match[1], raw: text.trim() };
        }
      }

      if (attempt < config.otpPollAttempts - 1) {
        await sleep(config.otpPollIntervalMs);
      }
    }

    throw new Error('OTP email not found within polling window');
  } finally {
    try {
      await client.logout();
    } catch (error) {
      // ignore
    }
  }
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m${remainingSeconds ? ` ${remainingSeconds}s` : ''}`;
}

async function waitForSocketEvent(socket, events, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      events.forEach((event) => socket.off(event, listeners[event]));
      reject(new Error(`Timed out waiting for ${events.join(', ')}`));
    }, timeoutMs);

    const listeners = {};
    events.forEach((event) => {
      listeners[event] = (payload) => {
        clearTimeout(timer);
        events.forEach((evt) => socket.off(evt, listeners[evt]));
        resolve({ event, payload });
      };
      socket.once(event, listeners[event]);
    });
  });
}

async function stepBackendAvailability() {
  const started = Date.now();
  const url = '/health';
  const response = await context.http.get(url, { timeout: config.httpTimeout });
  if (response.status !== 200) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  const payload = response.data || {};
  const serialized = JSON.stringify(payload).toLowerCase();
  if (!serialized.includes('healthy') && !serialized.includes('ok')) {
    throw new Error('Health payload missing healthy indicator');
  }
  return {
    status: 'pass',
    notes: `Backend reachable (${response.status}) in ${formatDuration(Date.now() - started)}`,
  };
}

async function stepDatabaseConnectivity() {
  const started = Date.now();
  try {
    const response = await context.http.get('/api/db-test', { timeout: config.httpTimeout });
    if (response.status !== 200) {
      throw new Error(`Unexpected status ${response.status}`);
    }
    const data = response.data || {};
    if (!data.db || data.db !== 'connected') {
      throw new Error('Backend DB probe did not confirm connection');
    }
  } catch (error) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL missing; cannot validate database');
    }
  }

  const client = await ensurePgClient();
  const tablesQuery = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const tables = tablesQuery.rows.map((row) => row.tablename.toLowerCase());
  const aliasMap = new Map([
    ['sensor_readings', ['sensordata', 'sensorreadings', 'sensor_data']],
    ['commands', ['command', 'devicecommands']],
    ['admins', ['admin']],
    ['user_sessions', ['usersessions', 'admin_sessions']],
    ['system_tests', ['systemtests', 'system_test']],
  ]);
  const required = ['sensor_readings', 'commands', 'admins', 'user_sessions', 'system_tests'];
  const missing = required.filter((tableName) => {
    const normalized = tableName.toLowerCase();
    if (tables.includes(normalized)) return false;
    const alternatives = aliasMap.get(tableName) || [];
    return !alternatives.some((alias) => tables.includes(alias.toLowerCase()));
  });
  if (missing.length > 0) {
    return {
      status: 'warn',
      notes: `Database reachable but missing tables: ${missing.join(', ')}`,
      suggestion: 'Run latest migrations on PostgreSQL instance.',
    };
  }
  return {
    status: 'pass',
    notes: `PostgreSQL connected (tables: ${tables.length}) in ${formatDuration(Date.now() - started)}`,
  };
}

async function stepAdminOtpFlow() {
  const loginPayload = {
    email: config.adminEmail,
    password: config.adminPassword,
  };
  const loginResponse = await context.http.post('/api/admin/login', loginPayload, { timeout: config.httpTimeout });
  if (loginResponse.status !== 200 && loginResponse.status !== 202) {
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }
  const loginData = loginResponse.data || {};
  const loginMessage = (loginData.message || '').toString().toLowerCase();
  const requires2FA = Boolean(loginData.data && loginData.data.requires2FA);
  if (!requires2FA && !loginMessage.includes('otp') && !loginMessage.includes('verification code')) {
    throw new Error('Login response did not confirm OTP dispatch');
  }

  const otp = await fetchOtpCode();
  context.otpCode = otp.code;

  const verifyResponse = await context.http.post('/api/admin/verify-otp', {
    email: config.adminEmail,
    otp: otp.code,
  }, { timeout: config.httpTimeout });

  if (verifyResponse.status !== 200) {
    throw new Error(`OTP verification failed with status ${verifyResponse.status}`);
  }

  const verifyData = verifyResponse.data || {};
  const token = verifyData.token || verifyData.data?.token;
  const user = verifyData.user || verifyData.data?.user;
  if (!token) {
    throw new Error('JWT token missing in OTP verification response');
  }
  context.adminToken = token;
  context.adminUser = user || { email: config.adminEmail };

  return {
    status: 'pass',
    notes: 'Admin credentials verified, OTP delivered, session token issued.',
  };
}

async function stepTelemetryValidation() {
  if (!context.adminToken) {
    return {
      status: 'fail',
      notes: 'Admin token unavailable; cannot validate telemetry.',
      suggestion: 'Resolve Step 3 (admin OTP) before rerunning.',
    };
  }

  const socketOptions = {
    path: config.socketPath,
    transports: ['polling', 'websocket'],
    auth: { token: context.adminToken },
    timeout: config.wsTimeout,
  };

  if (config.socketOrigin) {
    socketOptions.extraHeaders = { Origin: config.socketOrigin };
  }

  const socket = io(config.backendUrl, socketOptions);

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timeout')), config.wsTimeout);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', reject);
      socket.once('error', reject);
    });

    const eventPromise = waitForSocketEvent(socket, ['sensor_update', 'device_sensor_update', 'telemetryUpdate'], config.wsTimeout);

    const payload = {
      device_id: config.deviceId,
      soil_moisture: 60,
      temperature: 28.5,
      humidity: 75,
      float_sensor: 1,
      timestamp: new Date().toISOString(),
    };

    const postResponse = await context.http.post('/api/sensors', payload, { timeout: config.httpTimeout });
    if (postResponse.status !== 200 && postResponse.status !== 201 && postResponse.status !== 202) {
      throw new Error(`Telemetry POST failed with status ${postResponse.status}`);
    }

    const event = await eventPromise;

    const latestResponse = await context.http.get('/api/sensors/latest', {
      params: { deviceId: config.deviceId },
      timeout: config.httpTimeout,
    });
    const latestData = latestResponse.data?.data;
    const matched = latestData && ((Array.isArray(latestData) ? latestData[0] : latestData) || {});
    if (!matched || Number(matched.soil_moisture ?? matched.moisture) !== 60) {
      throw new Error('Latest sensor reading not updated with simulated payload');
    }

    const client = await ensurePgClient();
    const dbRows = await client.query('SELECT id, float_sensor FROM sensordata WHERE "deviceId" = $1 ORDER BY "timestamp" DESC LIMIT 1', [config.deviceId]);
    if (!dbRows.rows.length) {
      throw new Error('No sensor row persisted after telemetry');
    }

    return {
      status: 'pass',
      notes: `Telemetry stored, websocket event ${event.event} received, database row ${dbRows.rows[0].id}`,
    };
  } finally {
    socket.removeAllListeners();
    socket.disconnect();
  }
}

async function stepActuatorCommands() {
  if (!context.adminToken) {
    return {
      status: 'fail',
      notes: 'Admin token unavailable; cannot validate actuator commands.',
      suggestion: 'Resolve Step 3 (admin OTP) before rerunning.',
    };
  }

  const socketOptions = {
    path: config.socketPath,
    transports: ['polling', 'websocket'],
    auth: { token: context.adminToken },
    timeout: config.wsTimeout,
  };

  if (config.socketOrigin) {
    socketOptions.extraHeaders = { Origin: config.socketOrigin };
  }

  const socket = io(config.backendUrl, socketOptions);

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timeout')), config.wsTimeout);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', reject);
      socket.once('error', reject);
    });

    const commandResponse = await context.http.post('/api/command', {
      device_id: config.deviceId,
      actuator: 'solenoid2',
      action: 'on',
    }, {
      timeout: config.httpTimeout,
      validateStatus: () => true,
    });

    if (![200, 201, 202].includes(commandResponse.status)) {
      throw new Error(`Actuator command request failed with status ${commandResponse.status}`);
    }

    const commandPayload = commandResponse.data?.data || {};
    const commandId = commandPayload.command?.id || commandPayload.id;
    if (!commandId) {
      throw new Error('Command ID missing from actuator response');
    }

    const staleCommandIds = [];
    let deviceCommandId = null;
    let deviceCommandPayload = null;

  for (let attempt = 0; attempt < 25; attempt += 1) {
      const deviceCommandResponse = await context.http.get('/api/device-commands/next', {
        params: { deviceId: config.deviceId },
        timeout: config.httpTimeout,
        validateStatus: () => true,
      });

      if (deviceCommandResponse.status !== 200) {
        throw new Error(`Device command reservation failed with status ${deviceCommandResponse.status}`);
      }

      const candidate = deviceCommandResponse.data?.command || null;
      if (!candidate) {
        await sleep(500);
        continue;
      }

      const candidatePayload = candidate.payload || {};
      const candidateRowId = candidatePayload.commandRowId || candidatePayload.context?.commandRowId || null;

      if (Number(candidateRowId) === Number(commandId)) {
        deviceCommandId = candidate.id;
        deviceCommandPayload = candidatePayload;
        break;
      }

      staleCommandIds.push(candidate.id);
      const cleanupResponse = await context.http.post(`/api/device-commands/${candidate.id}/ack`, {
        status: 'completed',
        actuator: candidatePayload.actuatorKey || candidatePayload.actuator || candidate.type || 'actuator',
        payload: {
          actuatorKey: candidatePayload.actuatorKey || candidatePayload.actuator || candidate.type || 'actuator',
          commandRowId: candidateRowId,
        },
        message: 'Cleared stale command during readiness validation',
      }, {
        timeout: config.httpTimeout,
        validateStatus: () => true,
      });
      if (cleanupResponse.status !== 200 || cleanupResponse.data?.success === false) {
        throw new Error(`Failed to clear stale device command ${candidate.id} (status ${cleanupResponse.status})`);
      }
      await sleep(500);
    }

    if (!deviceCommandId) {
      throw new Error(`Unable to reserve device command for new request (cleared ${staleCommandIds.length} stale commands)`);
    }

    const eventPromise = waitForSocketEvent(socket, ['actuator_command_update', 'solenoid_command_update'], config.wsTimeout);

    const targetActuatorKey = deviceCommandPayload?.actuatorKey || 'solenoid2';
    const targetActuatorLabel = deviceCommandPayload?.actuator || targetActuatorKey;

    const ackResponse = await context.http.post(`/api/device-commands/${deviceCommandId}/ack`, {
      status: 'completed',
      actuator: targetActuatorKey,
      payload: {
        actuatorKey: targetActuatorKey,
        action: deviceCommandPayload?.desired || 'on',
        commandRowId: commandId,
      },
      message: 'System readiness check acknowledgement',
    }, {
      timeout: config.httpTimeout,
      validateStatus: () => true,
    });

    if (ackResponse.status !== 200 || ackResponse.data?.success === false) {
      throw new Error(`Actuator acknowledgement failed (status ${ackResponse.status}): ${ackResponse.data?.message || 'Unknown error'}`);
    }

    const ackStatus = ackResponse.data?.data?.command?.status || null;

    const event = await eventPromise;

    let match = null;
    const statusAttempts = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const statusResponse = await context.http.get('/api/command/status', {
        params: { device_id: config.deviceId },
        timeout: config.httpTimeout,
        validateStatus: () => true,
      });
      if (statusResponse.status !== 200) {
        await sleep(1000);
        continue;
      }
      const entries = statusResponse.data?.data?.commands || [];
      match = entries.find((entry) => Number(entry.id) === Number(commandId));
      if (match && match.status) {
        statusAttempts.push(match.status);
      }
      if (match && match.status === 'done') {
        break;
      }
      await sleep(1000);
    }

    if (!match || match.status !== 'done') {
      const observed = statusAttempts.length ? statusAttempts.join(' -> ') : 'no status reported';
      throw new Error(`Command did not transition to done status (observed: ${observed}, ack returned ${ackStatus || 'unknown'})`);
    }

    const client = await ensurePgClient();
    let dbStatus = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const dbRows = await client.query('SELECT status FROM commands WHERE id = $1', [commandId]);
      if (dbRows.rows.length) {
        dbStatus = dbRows.rows[0].status;
        if (dbStatus === 'done') {
          break;
        }
      }
      await sleep(1000);
    }
    if (dbStatus !== 'done') {
      throw new Error(`Commands table not updated with done status (current: ${dbStatus || 'null'})`);
    }

    const clearedNote = staleCommandIds.length ? ` after clearing ${staleCommandIds.length} stale command(s)` : '';

    return {
      status: 'pass',
      notes: `Actuator command acknowledged for ${targetActuatorLabel} (event ${event.event})${clearedNote}`,
    };
  } finally {
    socket.removeAllListeners();
    socket.disconnect();
  }
}

async function stepFloatSensorLogic() {
  if (!context.adminToken) {
    return {
      status: 'fail',
      notes: 'Admin token unavailable; cannot validate float safety.',
      suggestion: 'Resolve Step 3 (admin OTP) before rerunning.',
    };
  }

  await context.http.post('/api/sensors', {
    device_id: config.deviceId,
    soil_moisture: 58,
    temperature: 27.5,
    humidity: 74,
    float_sensor: 0,
    timestamp: new Date().toISOString(),
  }, { timeout: config.httpTimeout });

  const blockedResponse = await context.http.post('/api/command', {
    device_id: config.deviceId,
    actuator: 'pump',
    action: 'on',
  }, {
    timeout: config.httpTimeout,
    validateStatus: () => true,
  });

  if (blockedResponse.status < 400) {
    return {
      status: 'warn',
      notes: 'Actuator command accepted while float=0; confirm backend lockout logic.',
      suggestion: 'Ensure backend enforces float sensor interlock.',
    };
  }

  await context.http.post('/api/sensors', {
    device_id: config.deviceId,
    soil_moisture: 59,
    temperature: 27.9,
    humidity: 74,
    float_sensor: 1,
    timestamp: new Date().toISOString(),
  }, { timeout: config.httpTimeout });

  const client = await ensurePgClient();
  const row = await client.query('SELECT float_sensor FROM sensordata WHERE "deviceId" = $1 ORDER BY "timestamp" DESC LIMIT 1', [config.deviceId]);
  const floatValue = row.rows[0] ? Number(row.rows[0].float_sensor) : null;

  if (floatValue !== 1) {
    return {
      status: 'warn',
      notes: 'Float sensor did not return to unlocked state in database.',
      suggestion: 'Inspect telemetry ingestion and float reset logic.',
    };
  }

  return {
    status: 'pass',
    notes: 'Float safety enforced; actuator blocked while float=0 and restored when float=1.',
  };
}

async function stepWifiReconnect() {
  if (!context.adminToken) {
    return {
      status: 'fail',
      notes: 'Admin token unavailable; cannot simulate Wi-Fi reconnect.',
      suggestion: 'Resolve Step 3 (admin OTP) before rerunning.',
    };
  }

  const client = await ensurePgClient();
  await client.query(
    'INSERT INTO devices ("deviceId", status, "lastHeartbeat") VALUES ($1, $2, NOW())\n     ON CONFLICT ("deviceId") DO UPDATE SET status = EXCLUDED.status, "lastHeartbeat" = EXCLUDED."lastHeartbeat"',
    [config.deviceId, 'offline'],
  );

  await sleep(5000);

  await context.http.post('/api/sensors', {
    device_id: config.deviceId,
    soil_moisture: 63,
    temperature: 27.1,
    humidity: 72,
    float_sensor: 1,
    timestamp: new Date().toISOString(),
  }, { timeout: config.httpTimeout });

  const deviceResponse = await context.http.get('/api/devices', { timeout: config.httpTimeout });
  const deviceList = deviceResponse.data?.data || deviceResponse.data || [];
  const match = deviceList.find((device) => (device.deviceId || device.device_id) === config.deviceId);
  if (!match) {
    throw new Error('Device list missing monitored ESP32');
  }
  const status = (match.status || match.deviceStatus || '').toString().toLowerCase();
  if (status !== 'online') {
    return {
      status: 'warn',
      notes: `Device status is ${status}; expected online after reconnect`,
      suggestion: 'Verify device heartbeat update pipeline.',
    };
  }

  return {
    status: 'pass',
    notes: 'ESP32 offline state simulated and auto-reconnect confirmed.',
  };
}

async function prepareAuthenticatedPage(page) {
  if (!context.adminToken) {
    throw new Error('Missing admin token for front-end validation');
  }
  await page.goto(config.frontendUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate((token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('adminToken', token);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, context.adminToken, context.adminUser);
}

async function stepFrontendReadiness() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  context.browser = browser;
  const page = await browser.newPage();

  page.on('requestfailed', (request) => {
    try {
      console.warn('Frontend request failed', request.url(), request.failure() ? request.failure().errorText : 'unknown error');
    } catch (err) {
      // ignore logging errors
    }
  });

  page.on('response', async (response) => {
    try {
      const status = response.status();
      if (status >= 400) {
        console.warn('Frontend response issue', status, await response.text().catch(() => '<body omitted>')?.slice(0, 200), response.url());
      }
    } catch (err) {
      // ignore logging errors
    }
  });

  await prepareAuthenticatedPage(page);

  await page.goto(`${config.frontendUrl}/admin/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('Dashboard navigation landed on', await page.url());

  const initialAuthState = await page.evaluate(() => {
    let parsedUser = null;
    try {
      const raw = localStorage.getItem('user');
      parsedUser = raw ? JSON.parse(raw) : null;
    } catch (err) {
      parsedUser = { error: String(err) };
    }
    return {
      location: window.location.href,
      pathname: window.location.pathname,
      token: localStorage.getItem('token'),
      adminToken: localStorage.getItem('adminToken'),
      hasStorageUser: Boolean(localStorage.getItem('user')),
      parsedUser,
    };
  });
  console.log('Auth state after dashboard load', initialAuthState);

  await page.waitForSelector('nav button', { timeout: 20000 }).catch(() => null);
  console.log('After nav wait, current url', await page.url());

  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll('nav button'));
    const target = navButtons.find((btn) => (btn.textContent || '').toLowerCase().includes('monitoring'));
    if (target instanceof HTMLElement) {
      target.click();
    }
  });

  await page.waitForFunction(() => {
    const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
    return headings.some((el) => (el.textContent || '').toLowerCase().includes('actuator controls'));
  }, { timeout: 20000 }).catch(() => null);

  const actuatorLabels = ['Water Pump', 'Solenoid Valve 1', 'Solenoid Valve 2', 'Solenoid Valve 3'];
  for (const label of actuatorLabels) {
    const found = await page.evaluate((text) => {
      const needle = (text || '').toLowerCase();
      const selectors = ['button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'];
      return selectors.some((selector) => {
        const elements = Array.from(document.querySelectorAll(selector));
        return elements.some((el) => {
          const content = (el.innerText || el.textContent || '').toLowerCase();
          return content.includes(needle);
        });
      });
    }, label);
    if (!found) {
      throw new Error(`Dashboard missing actuator control for "${label}"`);
    }
  }

  await page.waitForSelector('a', { timeout: 10000 }).catch(() => null);
  await page.waitForFunction(() => {
    const header = document.querySelector('header.site-header');
    if (!header) return false;
    const candidates = Array.from(header.querySelectorAll('a, button, span'));
    return candidates.some((el) => (el.textContent || '').toLowerCase().includes('system tests'));
  }, { timeout: 15000 }).catch(() => null);

  const headerDebug = await page.evaluate(() => {
    const header = document.querySelector('header.site-header');
    const anchors = header ? Array.from(header.querySelectorAll('a')).map((el) => ({
      text: (el.innerText || el.textContent || '').trim(),
      href: el.getAttribute('href'),
      classes: el.className,
    })) : [];
    return { hasHeader: Boolean(header), anchors, html: header ? header.innerHTML : null };
  });
  console.log('Header debug info', headerDebug);
  console.log('Before system tests click, current url', await page.url());
  const systemTestsLinkClicked = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a'));
    const details = anchors.map((el) => ({
      text: (el.innerText || el.textContent || '').trim(),
      tag: el.tagName,
      className: el.className,
      href: el.getAttribute('href'),
    }));
    const target = anchors.find((el) => {
      const href = el.getAttribute('href') || '';
      const content = (el.innerText || el.textContent || '').toLowerCase();
      return href.includes('/admin/system-tests') || content.includes('system tests');
    });
    if (target && target instanceof HTMLElement) {
      target.click();
      return { clicked: true, text: target.innerText || target.textContent || '', anchors: details };
    }
    const debugMatches = Array.from(document.querySelectorAll('*'))
      .filter((el) => (el.innerText || el.textContent || '').toLowerCase().includes('system tests'))
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || el.textContent || '').trim(),
        classes: el.className,
        href: el instanceof HTMLAnchorElement ? el.getAttribute('href') : null,
      }));
    return { clicked: false, text: null, anchors: details, debugMatches };
  });

  if (systemTestsLinkClicked.clicked) {
    console.log('System tests link clicked', systemTestsLinkClicked.text || '(no label)');
  } else {
    console.warn('System tests link not found; anchors observed:', systemTestsLinkClicked.anchors);
    console.warn('Elements containing System Tests text:', systemTestsLinkClicked.debugMatches);
    await page.goto(`${config.frontendUrl}/admin/system-tests`, { waitUntil: 'networkidle2', timeout: 60000 });
  }

  await page.waitForFunction(() => window.location.pathname.includes('/admin/system-tests'), { timeout: 20000 }).catch(() => null);
  await page.waitForSelector('h1, h2, h3', { timeout: 20000 }).catch(() => null);
  const systemTestsSnapshot = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((el) => (el.textContent || '').trim());
    return {
      url: window.location.href,
      headings,
      match: headings.some((text) => text.toLowerCase().includes('system test')),
    };
  });
  if (!systemTestsSnapshot.match) {
    console.warn('System tests page snapshot', systemTestsSnapshot);
    throw new Error('System Test dashboard not rendered');
  }

  return {
    status: 'pass',
    notes: 'Frontend responsive; actuator controls and System Tests dashboard rendered.',
  };
}

function buildSummaryText() {
  const header = ['Test Area', 'Status', 'Notes'];
  const body = context.results.map((item) => [
    item.area,
    item.status === 'pass' ? '✅' : item.status === 'warn' ? '⚠' : '❌',
    item.notes,
  ]);
  const output = [header, ...body];
  const formatted = table(output, { drawHorizontalLine: () => false });
  return formatted.trim();
}

async function stepEmailReport() {
  const summary = buildSummaryText();
  fs.writeFileSync(config.summaryPath, `${summary}\n`, 'utf8');

  if (!config.gmailAppPassword) {
    return {
      status: 'warn',
      notes: 'Skipped email dispatch: Gmail app password missing.',
      suggestion: 'Set VERMILINKS_GMAIL_APP_PASSWORD to enable email report.',
    };
  }

  const emailScriptPath = path.join(__dirname, '..', 'send-email.js');

  const child = spawn(process.execPath, [emailScriptPath, config.summaryPath, config.summarySubject], {
    cwd: path.dirname(emailScriptPath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    return {
      status: 'warn',
      notes: `Email dispatch script exited with code ${exitCode}. ${stderr.trim()}`,
      suggestion: 'Verify Gmail credentials and send-email.js configuration.',
    };
  }

  return {
    status: 'pass',
    notes: 'Readiness summary emailed successfully.',
  };
}

async function runStep(label, area, runner) {
  process.stdout.write(chalk.cyan(`\n${label}\n`));
  const started = Date.now();
  try {
    const outcome = await runner();
    const status = outcome.status || 'pass';
    const notes = outcome.notes || 'Completed';
    const suggestion = outcome.suggestion || '';
    const display = statusDisplay[status] || statusDisplay.fail;
    console.log(display.color(`${display.icon} ${notes}`));
    recordResult(area, status, notes, suggestion);
    if (suggestion) {
      console.log(chalk.gray(`   Recommendation: ${suggestion}`));
    }
    console.log(chalk.gray(`   Duration: ${formatDuration(Date.now() - started)}`));
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.log(statusDisplay.fail.color(`${statusDisplay.fail.icon} ${message}`));
    const suggestion = error && error.suggestion ? error.suggestion : '';
    if (suggestion) {
      console.log(chalk.gray(`   Recommendation: ${suggestion}`));
    }
    recordResult(area, 'fail', message, suggestion);
    console.log(chalk.gray(`   Duration: ${formatDuration(Date.now() - started)}`));
  }
}

function printFinalSummary() {
  const tableData = [
    ['Test Area', 'Status', 'Notes', 'Suggested Fix'],
    ...summaryRows.map(([area, status, notes, suggestion]) => {
      const display = statusDisplay[status] || statusDisplay.fail;
      return [
        area,
        display.color(display.icon),
        notes,
        suggestion,
      ];
    }),
  ];
  const output = table(tableData, { drawHorizontalLine: (index, size) => index === 0 || index === size });
  console.log(chalk.cyan('\nSystem Readiness Summary')); 
  console.log(output.trim());
}

async function main() {
  console.log(chalk.bold(`\n🚀 Starting VermiLinks System Readiness Check`));
  console.log(chalk.gray(`Backend: ${config.backendUrl}`));
  console.log(chalk.gray(`Frontend: ${config.frontendUrl}`));
  console.log(chalk.gray(`Device ID: ${config.deviceId}`));

  await runStep('STEP 1 — Backend Availability', 'Backend Health', stepBackendAvailability);
  await runStep('STEP 2 — Database Connectivity', 'Database', stepDatabaseConnectivity);
  await runStep('STEP 3 — Admin Login + OTP', 'Admin Login + OTP', stepAdminOtpFlow);
  await runStep('STEP 4 — Telemetry Endpoint Validation', 'Telemetry', stepTelemetryValidation);
  await runStep('STEP 5 — Actuator Command Verification', 'Actuators', stepActuatorCommands);
  await runStep('STEP 6 — Float Sensor Safety Logic', 'Float Sensor Logic', stepFloatSensorLogic);
  await runStep('STEP 7 — ESP32 Wi-Fi Reconnect Simulation', 'ESP32 Wi-Fi Reconnect', stepWifiReconnect);
  await runStep('STEP 8 — Frontend Readiness', 'Frontend', stepFrontendReadiness);
  await runStep('STEP 9 — Email Notification Test', 'Email Report', stepEmailReport);

  printFinalSummary();

  const failures = context.results.filter((item) => item.status === 'fail');
  if (failures.length === 0) {
    console.log(chalk.green('\n🎉 All systems operational – VermiLinks ready for live deployment'));
  } else {
    console.log(chalk.red(`\n${failures.length} check(s) failed. Review recommendations above before deployment.`));
  }
}

main()
  .catch((error) => {
    console.error(chalk.red(`Verification failed: ${error.message || error}`));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (context.pgClient) {
      try {
        await context.pgClient.end();
      } catch (error) {
        // ignore
      }
    }
    if (context.browser) {
      try {
        await context.browser.close();
      } catch (error) {
        // ignore
      }
    }
  });
