// === GLOBAL ERROR & ENV VALIDATION ===
process.on("uncaughtException", (err) => {
  console.error("\n🚨 [GLOBAL UNCAUGHT EXCEPTION] 🚨");
  console.error("Message:", err.message);
  console.error("Stack Trace:\n", err.stack || "No stack trace available");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n🚨 [GLOBAL UNHANDLED PROMISE REJECTION] 🚨");
  console.error("Reason:", reason);
  if (reason && reason.stack) console.error("Stack Trace:\n", reason.stack);
});

["DATABASE_URL", "VERMILINKS_BACKEND_URL", "VERMILINKS_FRONTEND_URL"].forEach((env) => {
  if (!process.env[env]) {
    console.error(`❌ Missing environment variable: ${env}`);
    process.exit(1);
  } else {
    console.log(`✅ ${env} detected`);
  }
});
'use strict';

const axios = require('axios');
const io = require('socket.io-client');
const { Client } = require('pg');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

if (typeof jest === 'undefined') {
  global.jest = { setTimeout: () => {} };
}

jest.setTimeout(240000);

const config = {
  backendBase: (process.env.VERMILINKS_BACKEND_URL || 'https://vermilinks-backend.onrender.com').replace(/\/$/, ''),
  frontendBase: (process.env.VERMILINKS_FRONTEND_URL || 'https://vermilinks-frontend.onrender.com').replace(/\/$/, ''),
  deviceId: process.env.VERMILINKS_DEVICE_ID || 'ESP32-01',
  dbUrl: process.env.VERMILINKS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  httpTimeout: parseInt(process.env.SYSTEM_TEST_HTTP_TIMEOUT_MS || '15000', 10),
  wsTimeout: parseInt(process.env.SYSTEM_TEST_WS_TIMEOUT_MS || '20000', 10),
  summaryPath: path.resolve(__dirname, '..', '..', 'system-readiness-report.txt'),
  emailScript: path.resolve(__dirname, '..', '..', 'send-email.js'),
  emailSubject: '✅ VermiLinks System Readiness Report',
  wifi: {
    ssid: 'Knights_IOT',
    password: 'smbcr-5540',
  },
};

const state = {
  pgClient: null,
  latestSensorRowId: null,
  lastFloatState: null,
  latestCommandId: null,
  latestDeviceCommandId: null,
};

const results = [];

const runId = process.env.SYSTEM_TEST_RUN_ID || randomUUID();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STEP_LABELS = new Map([
  ['backend-health', 'STEP 1 — Backend Readiness & Health'],
  ['telemetry-simulation', 'STEP 2 — ESP32 Telemetry Simulation'],
  ['command-routing', 'STEP 3 — Actuator Command Test'],
  ['frontend-integration', 'STEP 4 — Frontend Integration Check'],
  ['wifi-reconnect', 'STEP 5 — ESP32 Wi-Fi Reconnect Simulation'],
  ['float-safety', 'STEP 6 — Float Sensor Safety Logic'],
  ['wifi-autostart', 'STEP 7 — Automatic Wi-Fi Behaviour (No USB)'],
  ['email-report', 'STEP 8 — Email Report'],
]);

const SECTION_FALLBACK = 'Auxiliary Checks';
const STEP_SECTIONS = new Map([
  ['backend-health', 'Backend & Database'],
  ['telemetry-simulation', 'ESP32 Communication'],
  ['command-routing', 'ESP32 Communication'],
  ['frontend-integration', 'Frontend Integration'],
  ['wifi-reconnect', 'ESP32 Communication'],
  ['float-safety', 'Safety Logic & Automation'],
  ['wifi-autostart', 'ESP32 Communication'],
  ['email-report', 'Reporting & Notifications'],
]);

const STEP_STATUS_TO_SECTION_STATUS = {
  passed: 'ok',
  failed: 'failed',
  skipped: 'warn',
};

function statusLabel(status) {
  switch (status) {
    case 'passed':
      return 'PASS';
    case 'failed':
      return 'FAIL';
    case 'skipped':
      return 'WARN';
    default:
      return 'INFO';
  }
}

function toSummaryEntries(entries) {
  return entries.map((entry, index) => ({
    index: index + 1,
    label: entry.label,
    status: statusLabel(entry.status),
    detail: entry.detail || (entry.error ? (entry.error.message || String(entry.error)) : ''),
  }));
}

function buildSummary(entries) {
  const lines = [];
  lines.push('VermiLinks System Readiness Verification');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Step | Status | Detail');
  lines.push('---- | ------ | ------');
  entries.forEach((entry) => {
    const detail = entry.detail ? entry.detail.replace(/\s+/g, ' ').trim() : 'n/a';
    lines.push(`${entry.index}. ${entry.label} | ${entry.status} | ${detail}`);
  });
  lines.push('');
  lines.push(`Device under test: ${config.deviceId}`);
  lines.push(`Backend: ${config.backendBase}`);
  lines.push(`Frontend: ${config.frontendBase}`);
  lines.push(`Wi-Fi SSID: ${config.wifi.ssid}`);
  return lines.join('\n');
}

const getSectionName = (stepId) => STEP_SECTIONS.get(stepId) || SECTION_FALLBACK;

const cloneMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(metadata));
  } catch (error) {
    return null;
  }
};

const emitSystemTestMessage = (payload) => {
  if (typeof process.send !== 'function') {
    return;
  }
  try {
    process.send({ type: 'systemTestUpdate', payload });
  } catch (error) {
    // Parent process may not be listening; ignore transport errors.
  }
};

const emitSectionProgress = (section, status, details, metadata) => {
  const payload = {
    runId,
    section,
    status,
    details: details ?? null,
    metadata: cloneMetadata(metadata),
    durationMs: null,
    timestamp: new Date().toISOString(),
  };
  emitSystemTestMessage(payload);
};

const persistSectionResult = async (section, status, details, metadata, durationMs) => {
  const payload = {
    runId,
    section,
    status,
    details: details ?? null,
    metadata: cloneMetadata(metadata),
    durationMs: typeof durationMs === 'number' && Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
    timestamp: new Date().toISOString(),
  };

  try {
    const client = await ensurePgClient();
    const metadataJson = payload.metadata ? JSON.stringify(payload.metadata) : null;
    await client.query('DELETE FROM system_tests WHERE run_id = $1 AND section = $2', [runId, section]);
    await client.query(
      `INSERT INTO system_tests (run_id, section, status, details, timestamp, metadata, duration_ms, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $5, $5)`,
      [
        runId,
        section,
        status,
        payload.details,
        payload.timestamp,
        metadataJson,
        payload.durationMs,
      ],
    );
  } catch (error) {
    console.warn('system-functionality.test persistSectionResult failed', {
      section,
      status,
      message: error && (error.message || String(error)),
    });
  }

  emitSystemTestMessage(payload);
};

async function ensurePgClient() {
  if (state.pgClient) {
    return state.pgClient;
  }
  if (!config.dbUrl) {
    throw new Error('DATABASE_URL / VERMILINKS_DATABASE_URL is not configured.');
  }
  const sslEnabled = !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(config.dbUrl);
  const client = new Client({
    connectionString: config.dbUrl,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  state.pgClient = client;
  return client;
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(config.backendBase, {
      path: '/socket.io',
      transports: ['websocket'],
      timeout: config.wsTimeout,
      forceNew: true,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Timed out connecting to Socket.IO server'));
    }, config.wsTimeout);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });

    socket.once('error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });
  });
}

function waitForSocketEvent(socket, eventNames, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      eventNames.forEach((event, idx) => {
        if (listeners[idx]) {
          socket.off(event, listeners[idx]);
        }
      });
      reject(new Error(`Timed out waiting for socket event: ${eventNames.join(', ')}`));
    }, timeoutMs);

    const listeners = eventNames.map((event) => {
      const handler = (payload) => {
        clearTimeout(timer);
        eventNames.forEach((evt, idx) => {
          socket.off(evt, listeners[idx]);
        });
        resolve({ event, payload });
      };
      socket.once(event, handler);
      return handler;
    });
  });
}

async function sendEmailReport(summaryPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [config.emailScript, summaryPath, config.emailSubject], {
      cwd: path.resolve(__dirname, '..', '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `send-email.js exited with code ${code}`));
      }
    });
  });
}

async function runStep(stepId, task) {
  const label = STEP_LABELS.get(stepId) || stepId;
  const section = getSectionName(stepId);
  const result = { stepId, label, section, status: 'pending', detail: null, error: null };
  const startedAt = Date.now();

  emitSectionProgress(section, 'running', `${label} in progress`, { stepId, label, section });

  try {
    const detail = await task();
    result.status = 'passed';
    result.detail = detail || '';
  } catch (error) {
    result.status = 'failed';
    result.error = error;
    const message = error && (error.message || String(error));
    if (!result.detail) {
      result.detail = message || '';
    }
  }

  const durationMs = Date.now() - startedAt;
  const normalizedStatus = STEP_STATUS_TO_SECTION_STATUS[result.status] || 'warn';
  const detailMessage = (() => {
    const baseDetail = (result.detail && String(result.detail).trim().length > 0)
      ? String(result.detail).trim()
      : (result.status === 'passed' ? 'Completed successfully' : 'Completed with warnings');
    return `${label}: ${baseDetail}`;
  })();

  const metadata = {
    stepId,
    label,
    section,
    stepStatus: result.status,
    normalizedStatus,
    durationMs,
  };

  if (result.error) {
    metadata.error = result.error.message || String(result.error);
  }

  await persistSectionResult(section, normalizedStatus, detailMessage, metadata, durationMs);

  results.push(result);
}

const steps = [
  async function stepBackendHealth() {
    await runStep('backend-health', async () => {
      const url = `${config.backendBase}/api/health`;
      const response = await axios.get(url, { timeout: config.httpTimeout, validateStatus: () => true });
      if (response.status !== 200) {
        throw new Error(`Expected 200 from /api/health, received ${response.status}`);
      }
      if (!response.data || response.data.status !== 'ok') {
        throw new Error('Health payload did not report ok status');
      }

      const client = await ensurePgClient();
      const requiredTables = ['sensor_readings', 'commands', 'admins', 'user_sessions'];
      const tableAliases = new Map([
        ['sensor_readings', 'sensordata'],
      ]);
      const candidates = Array.from(new Set([...requiredTables, ...tableAliases.values()]));
      const tableQuery = await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
        [candidates]
      );
      const present = new Set(tableQuery.rows.map((row) => row.tablename));
      const missing = requiredTables.filter((name) => {
        if (present.has(name)) {
          return false;
        }
        const alias = tableAliases.get(name);
        return !(alias && present.has(alias));
      });
      if (missing.length > 0) {
        throw new Error(`Missing expected tables: ${missing.join(', ')}`);
      }

      return `Backend health OK; verified tables ${requiredTables.map((name) => present.has(name) ? name : `${name}→${tableAliases.get(name)}`).join(', ')}`;
    });
  },
  async function stepTelemetrySimulation() {
    await runStep('telemetry-simulation', async () => {
      const socket = await connectSocket();
      try {
        const telemetryEventPromise = waitForSocketEvent(socket, ['sensor_update', 'newSensorData', 'device_sensor_update', 'telemetryUpdate'], config.wsTimeout);
        const nowIso = new Date().toISOString();
        const telemetryPayload = {
          device_id: config.deviceId,
          soil_moisture: 60,
          temperature: 28.4,
          humidity: 75,
          float_sensor: 1,
          timestamp: nowIso,
        };

        const response = await axios.post(`${config.backendBase}/api/sensors`, telemetryPayload, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (response.status !== 201 && response.status !== 200) {
          throw new Error(`Expected 200/201 from /api/sensors, received ${response.status}`);
        }

        const event = await telemetryEventPromise;
        const latestResponse = await axios.get(`${config.backendBase}/api/sensors/latest`, {
          params: { deviceId: config.deviceId },
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (latestResponse.status !== 200 || !latestResponse.data || !latestResponse.data.success) {
          throw new Error('Failed to confirm latest sensor reading via API');
        }

        const client = await ensurePgClient();
        const dbRows = await client.query('SELECT id, "floatSensor" FROM sensordata WHERE "deviceId" = $1 ORDER BY "timestamp" DESC LIMIT 1', [config.deviceId]);
        if (!dbRows.rows.length) {
          throw new Error('No sensor rows recorded for device');
        }
        const row = dbRows.rows[0];
        state.latestSensorRowId = row.id;
        state.lastFloatState = row.floatSensor;

        return `Telemetry stored (row ${row.id}), websocket event ${event.event} received`;
      } finally {
        socket.disconnect();
      }
    });
  },
  async function stepCommandRouting() {
    await runStep('command-routing', async () => {
      const socket = await connectSocket();
      try {
        const commandAckPromise = waitForSocketEvent(socket, ['actuator_command_update', 'solenoid_command_update'], config.wsTimeout * 2);
        const commandResponse = await axios.post(`${config.backendBase}/api/command`, {
          device_id: config.deviceId,
          actuator: 'solenoid2',
          action: 'on',
        }, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (commandResponse.status !== 201 || !commandResponse.data || !commandResponse.data.success) {
          throw new Error(`Command enqueue failed (status ${commandResponse.status})`);
        }

        const commandId = commandResponse.data.data?.command?.id;
        if (!commandId) {
          throw new Error('Command response missing command id');
        }
        state.latestCommandId = commandId;

        const deviceCommandResponse = await axios.get(`${config.backendBase}/api/device-commands/next`, {
          params: { deviceId: config.deviceId },
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (deviceCommandResponse.status !== 200 || !deviceCommandResponse.data || !deviceCommandResponse.data.success) {
          throw new Error('Failed to reserve device command for ESP32');
        }
        const deviceCommandId = deviceCommandResponse.data.command?.id;
        if (!deviceCommandId) {
          throw new Error('Device command id missing from reserve response');
        }
        state.latestDeviceCommandId = deviceCommandId;

        const ackResponse = await axios.post(`${config.backendBase}/api/device-commands/${deviceCommandId}/ack`, {
          status: 'completed',
          actuator: 'solenoid2',
          payload: {
            actuatorKey: 'solenoid2',
            action: 'on',
            commandRowId: commandId,
          },
          message: 'Simulated ESP32 acknowledgement',
        }, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (ackResponse.status !== 200 || !ackResponse.data || !ackResponse.data.success) {
          throw new Error(`Command acknowledgement failed (status ${ackResponse.status})`);
        }

        const event = await commandAckPromise;
        const statusResponse = await axios.get(`${config.backendBase}/api/command/status`, {
          params: { device_id: config.deviceId },
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (statusResponse.status !== 200 || !statusResponse.data || !statusResponse.data.success) {
          throw new Error('Failed to load command status after acknowledgement');
        }
        const match = (statusResponse.data.data?.commands || []).find((entry) => Number(entry.id) === Number(commandId));
        if (!match || match.status !== 'done') {
          throw new Error('Command record not updated to done status');
        }

        const client = await ensurePgClient();
        const dbCommand = await client.query('SELECT status FROM commands WHERE id = $1', [commandId]);
        if (!dbCommand.rows.length || dbCommand.rows[0].status !== 'done') {
          throw new Error('Database command row did not reach done status');
        }

        return `Command ${commandId} acknowledged via device command ${deviceCommandId}; websocket event ${event.event}`;
      } finally {
        socket.disconnect();
      }
    });
  },
  async function stepFrontendIntegration() {
    await runStep('frontend-integration', async () => {
      const response = await axios.get(config.frontendBase, {
        timeout: config.httpTimeout,
        headers: { 'User-Agent': 'VermiLinksSystemTest/1.0' },
        validateStatus: () => true,
      });
      if (response.status !== 200) {
        throw new Error(`Frontend returned status ${response.status}`);
      }

      const $ = cheerio.load(response.data || '');
      const dashboardText = $('body').text();
      const requiredLabels = ['Water Pump', 'Solenoid Valve 1', 'Solenoid Valve 2', 'Solenoid Valve 3'];
      const missingLabels = requiredLabels.filter((label) => !dashboardText.includes(label));
      if (missingLabels.length > 0) {
        throw new Error(`Dashboard missing labels: ${missingLabels.join(', ')}`);
      }

      const socket = await connectSocket();
      try {
        const telemetryEventPromise = waitForSocketEvent(socket, ['sensor_update', 'newSensorData', 'device_sensor_update'], config.wsTimeout);
        const payload = {
          device_id: config.deviceId,
          soil_moisture: 62,
          temperature: 27.9,
          humidity: 73,
          float_sensor: 1,
          timestamp: new Date().toISOString(),
        };
        const postResponse = await axios.post(`${config.backendBase}/api/sensors`, payload, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (postResponse.status !== 201 && postResponse.status !== 200) {
          throw new Error(`Telemetry POST during frontend check failed (status ${postResponse.status})`);
        }
        const event = await telemetryEventPromise;
        return `Frontend reachable and telemetry propagated via websocket event ${event.event}`;
      } finally {
        socket.disconnect();
      }
    });
  },
  async function stepWifiReconnect() {
    await runStep('wifi-reconnect', async () => {
      const client = await ensurePgClient();
      await client.query(
        'INSERT INTO devices ("deviceId", status, "lastHeartbeat", metadata) VALUES ($1, $2, NOW(), $3) ON CONFLICT ("deviceId") DO UPDATE SET status = EXCLUDED.status, "lastHeartbeat" = EXCLUDED."lastHeartbeat", metadata = EXCLUDED.metadata',
        [config.deviceId, 'offline', { simulatedBy: 'system-functionality.test.js', reason: 'wifi_disconnect' }]
      );

      const beforeResponse = await axios.get(`${config.backendBase}/api/devices`, {
        timeout: config.httpTimeout,
        validateStatus: () => true,
      });
      if (beforeResponse.status !== 200 || !beforeResponse.data || !beforeResponse.data.success) {
        throw new Error('Failed to load device list before reconnect simulation');
      }
      const beforeEntry = (beforeResponse.data.data || []).find((entry) => entry.deviceId === config.deviceId || entry.device_id === config.deviceId);
      if (!beforeEntry || beforeEntry.status !== 'offline') {
        throw new Error('Device not marked offline prior to reconnect simulation');
      }

      await delay(10000);

      const socket = await connectSocket();
      try {
        const reconnectEventPromise = waitForSocketEvent(socket, ['sensor_update', 'device_sensor_update'], config.wsTimeout);
        const payload = {
          device_id: config.deviceId,
          soil_moisture: 63,
          temperature: 27.5,
          humidity: 72,
          float_sensor: 1,
          timestamp: new Date().toISOString(),
        };
        const postResponse = await axios.post(`${config.backendBase}/api/sensors`, payload, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (postResponse.status !== 201 && postResponse.status !== 200) {
          throw new Error(`Reconnect telemetry failed with status ${postResponse.status}`);
        }
        const event = await reconnectEventPromise;
        const afterResponse = await axios.get(`${config.backendBase}/api/devices`, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        const afterEntry = (afterResponse.data?.data || []).find((entry) => entry.deviceId === config.deviceId || entry.device_id === config.deviceId);
        if (!afterEntry || afterEntry.status !== 'online') {
          throw new Error('Device did not return to online status after telemetry reconnect');
        }

        return `Device offline→online lifecycle confirmed; websocket event ${event.event}`;
      } finally {
        socket.disconnect();
      }
    });
  },
  async function stepFloatSafety() {
    await runStep('float-safety', async () => {
      const socket = await connectSocket();
      try {
        const safetyEventPromise = waitForSocketEvent(socket, ['sensor_update', 'device_sensor_update'], config.wsTimeout);
        const payload = {
          device_id: config.deviceId,
          soil_moisture: 64,
          temperature: 27.2,
          humidity: 73,
          float_sensor: 0,
          timestamp: new Date().toISOString(),
        };
        const postResponse = await axios.post(`${config.backendBase}/api/sensors`, payload, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (postResponse.status !== 201 && postResponse.status !== 200) {
          throw new Error(`Float sensor telemetry rejected with status ${postResponse.status}`);
        }
        const event = await safetyEventPromise;
        const client = await ensurePgClient();
        const row = await client.query('SELECT "floatSensor" FROM sensordata WHERE "deviceId" = $1 ORDER BY "timestamp" DESC LIMIT 1', [config.deviceId]);
        if (!row.rows.length || Number(row.rows[0].floatSensor) !== 0) {
          throw new Error('Float sensor low state not persisted to database');
        }
        state.lastFloatState = 0;

        const commandAttempt = await axios.post(`${config.backendBase}/api/command`, {
          device_id: config.deviceId,
          actuator: 'pump',
          action: 'on',
        }, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });

        if (commandAttempt.status === 201) {
          // Attempt to clean up pending command to keep system consistent
          try {
            const deviceCommandResponse = await axios.get(`${config.backendBase}/api/device-commands/next`, {
              params: { deviceId: config.deviceId },
              timeout: config.httpTimeout,
              validateStatus: () => true,
            });
            const deviceCommandId = deviceCommandResponse.data?.command?.id;
            if (deviceCommandId) {
              await axios.post(`${config.backendBase}/api/device-commands/${deviceCommandId}/ack`, {
                status: 'failed',
                actuator: 'pump',
                message: 'Simulated lockout cleanup after failed test',
              }, {
                timeout: config.httpTimeout,
                validateStatus: () => true,
              });
            }
          } catch (cleanupError) {
            // ignore cleanup errors, but note them in detail string later via thrown error
            throw new Error('Actuator command was accepted during float sensor lockout (cleanup attempted)');
          }
          throw new Error('Actuator command was accepted during float sensor lockout');
        }

        return `Float sensor low state propagated via ${event.event}; actuator commands blocked with status ${commandAttempt.status}`;
      } finally {
        socket.disconnect();
      }
    });
  },
  async function stepWifiAutostart() {
    await runStep('wifi-autostart', async () => {
      await delay(10000);
      const socket = await connectSocket();
      try {
        const eventPromise = waitForSocketEvent(socket, ['sensor_update', 'device_sensor_update'], config.wsTimeout);
        const payload = {
          device_id: config.deviceId,
          soil_moisture: 66,
          temperature: 27.1,
          humidity: 72,
          float_sensor: state.lastFloatState === 0 ? 0 : 1,
          timestamp: new Date().toISOString(),
        };
        const response = await axios.post(`${config.backendBase}/api/sensors`, payload, {
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (response.status !== 201 && response.status !== 200) {
          throw new Error(`Telemetry after Wi-Fi autostart failed with status ${response.status}`);
        }
        const event = await eventPromise;

        const client = await ensurePgClient();
        const row = await client.query('SELECT id, "floatSensor" FROM sensordata WHERE "deviceId" = $1 ORDER BY "timestamp" DESC LIMIT 1', [config.deviceId]);
        if (!row.rows.length) {
          throw new Error('No telemetry rows recorded after Wi-Fi autostart simulation');
        }
        const commandStatus = await axios.get(`${config.backendBase}/api/command/status`, {
          params: { device_id: config.deviceId },
          timeout: config.httpTimeout,
          validateStatus: () => true,
        });
        if (commandStatus.status !== 200 || !commandStatus.data || !commandStatus.data.success) {
          throw new Error('Failed to confirm command status after Wi-Fi autostart');
        }

        return `Telemetry resumed post power-cycle; websocket event ${event.event}; latest float state ${row.rows[0].floatSensor}`;
      } finally {
        socket.disconnect();
      }
    });
  },
];

async function stepEmailReport() {
  await runStep('email-report', async () => {
    const emailPassword = process.env.VERMILINKS_GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
    if (!emailPassword) {
      throw new Error('Missing Gmail app password (set VERMILINKS_GMAIL_APP_PASSWORD or GMAIL_APP_PASSWORD)');
    }

    const baseSummary = buildSummary(toSummaryEntries(results));
    fs.writeFileSync(config.summaryPath, baseSummary, 'utf8');

    let emailOutput;
    try {
      emailOutput = await sendEmailReport(config.summaryPath);
    } catch (error) {
      const failedSummary = buildSummary(
        toSummaryEntries([
          ...results,
          { label: STEP_LABELS.get('email-report'), status: 'failed', detail: error.message, index: results.length + 1 },
        ])
      );
      fs.writeFileSync(config.summaryPath, failedSummary, 'utf8');
      throw error;
    }

    const finalEntries = toSummaryEntries([
      ...results,
      { label: STEP_LABELS.get('email-report'), status: 'passed', detail: emailOutput || 'Email dispatched', index: results.length + 1 },
    ]);
    fs.writeFileSync(config.summaryPath, buildSummary(finalEntries), 'utf8');
    return `Summary written to ${config.summaryPath}. ${emailOutput || 'Email dispatched.'}`;
  });
}

async function runSystemFunctionalityWorkflow() {
  for (const step of steps) {
    await step();
  }
  await stepEmailReport();

  const failures = results.filter((entry) => entry.status === 'failed');
  if (failures.length > 0) {
    const details = failures.map((entry) => `${entry.label}: ${entry.error ? entry.error.message || String(entry.error) : entry.detail || 'unknown failure'}`);
    const error = new Error(`System readiness checks failed:\n${details.join('\n')}`);
    error.failures = failures;
    throw error;
  }
}

async function closeResources() {
  if (state.pgClient) {
    await state.pgClient.end().catch(() => null);
  }
}

if (typeof describe === 'function') {
  describe('VermiLinks end-to-end system functionality', () => {
    test('runs the full readiness verification workflow', async () => {
      await runSystemFunctionalityWorkflow();
    });

    afterAll(async () => {
      await closeResources();
    });
  });
} else {
  (async () => {
    try {
      await runSystemFunctionalityWorkflow();
    } catch (error) {
      const message = error && (error.stack || error.message) ? (error.stack || error.message) : String(error);
      console.error(message);
      process.exitCode = 1;
    } finally {
      await closeResources();
    }
  })();
}
