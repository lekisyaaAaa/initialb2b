const express = require('express');
// Mongoose removed. Using Sequelize/Postgres only.
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const { Server: SocketIOServer } = require('socket.io');
const http = require('http');
const path = require('path');
const envFile = (process.env.NODE_ENV || '').toLowerCase() === 'test' ? '.env.test' : '.env';
require('dotenv').config({ path: path.join(__dirname, envFile), override: true });
const { validateEnv } = require('./utils/validateEnv');
validateEnv();
const logger = require('./utils/logger');
const database = require('./services/database_pg');
const sequelize = database;
const connectDB = typeof sequelize.connectDB === 'function' ? sequelize.connectDB : async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected (fallback connectDB)');
  } catch (error) {
    logger.error('Database connection failed during fallback connectDB', error);
    throw error;
  }
};
const { ensureDatabaseSetup } = database;
const schemaReady = ensureDatabaseSetup({ force: (process.env.NODE_ENV || 'development') === 'test' });
const {
  ensureDefaultActuators,
  listActuators,
  scheduleAutomaticControl,
  markDeviceAck,
} = require('./services/actuatorService');
const deviceCommandQueue = require('./services/deviceCommandQueue');

// Import routes
const authRoutes = require('./routes/auth');
const sensorRoutes = require('./routes/sensors');
const alertRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const actuatorRoutes = require('./routes/actuators');
const maintenanceRoutes = require('./routes/maintenance');
const notificationRoutes = require('./routes/notifications');
const actuatorControlRoutes = require('./routes/actuatorControl');
const deviceCommandRoutes = require('./routes/deviceCommands');
const commandRoutes = require('./routes/command');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || process.env.API_RATE_LIMIT_WINDOW_MS || '900000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || process.env.API_RATE_LIMIT_MAX_REQUESTS || '5', 10);

const adminAuthLimiter = rateLimit({
  windowMs: Number.isFinite(rateLimitWindowMs) && rateLimitWindowMs > 0 ? rateLimitWindowMs : 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
  },
});

const isProductionEnv = (process.env.NODE_ENV || 'development') === 'production';
const normalizeOrigin = (origin) => {
  if (!origin) {
    return '';
  }
  try {
    return new URL(origin).origin;
  } catch (error) {
    return origin.replace(/\/$/, '');
  }
};

const rawCorsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedCorsOrigins = rawCorsOrigins.map(normalizeOrigin).filter(Boolean);
const allowAllHttpOrigins = !isProductionEnv || allowedCorsOrigins.length === 0;

const rawSocketOrigins = (process.env.SOCKETIO_CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedSocketOrigins = (rawSocketOrigins.length > 0 ? rawSocketOrigins : rawCorsOrigins)
  .map(normalizeOrigin)
  .filter(Boolean);
const allowAllSocketOrigins = !isProductionEnv || allowedSocketOrigins.length === 0;

const isOriginPermitted = (origin, list, allowAll) => {
  if (!origin) {
    return true;
  }
  if (allowAll) {
    return true;
  }
  const normalized = normalizeOrigin(origin);
  return list.includes(normalized);
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginPermitted(origin, allowedCorsOrigins, allowAllHttpOrigins)) {
      return callback(null, true);
    }
    logger.warn('CORS origin rejected', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

if (isProductionEnv && allowedCorsOrigins.length === 0) {
  logger.warn('CORS_ORIGINS not set; allowing all origins in production');
}

if (isProductionEnv && allowedSocketOrigins.length === 0) {
  logger.warn('SOCKETIO_CORS_ORIGINS not set; allowing all socket origins in production');
}

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginPermitted(origin, allowedSocketOrigins, allowAllSocketOrigins)) {
        return callback(null, true);
      }
      logger.warn('Socket origin rejected', { origin });
      return callback(new Error('Socket origin not allowed'));
    },
    credentials: true,
  },
  serveClient: false,
  transports: ['websocket', 'polling'],
});

global.io = io;

io.on('connection', async (socket) => {
  logger.info('Socket.IO client connected', { socketId: socket.id });

  const handshakeDeviceId = (() => {
    const authId = socket.handshake && socket.handshake.auth ? socket.handshake.auth.deviceId : null;
    const queryId = socket.handshake && socket.handshake.query ? socket.handshake.query.deviceId : null;
    const candidate = authId || queryId;
    return candidate && String(candidate).trim().length > 0 ? String(candidate).trim() : null;
  })();

  if (handshakeDeviceId) {
    const metadata = (socket.handshake && socket.handshake.auth && socket.handshake.auth.metadata) || {};
    deviceCommandQueue.registerSocket(handshakeDeviceId, socket, metadata);
  }

  try {
    const actuators = await listActuators();
    socket.emit('actuator_snapshot', actuators);
    // Backward compatibility during migration
    socket.emit('actuatorSnapshot', actuators);
  } catch (error) {
    socket.emit('actuator_snapshot', []);
    socket.emit('actuatorSnapshot', []);
  }

  const handleAckEvent = async (payload = {}, overrideSuccess = null) => {
    const commandId = payload.commandId || payload.id;
    if (!commandId) {
      return;
    }

    const computedSuccess = overrideSuccess !== null
      ? overrideSuccess
      : !(payload.status === 'error' || payload.status === 'failed');

    const ackPayload = payload.payload || payload.data || null;
    const message = payload.message || null;

    try {
      const result = await deviceCommandQueue.handleCommandAck({
        commandId,
        success: computedSuccess,
        payload: ackPayload,
        message,
      });

      if (result && result.command && result.command.payload && result.command.payload.actuator) {
        await markDeviceAck(result.command.payload.actuator, computedSuccess, { message });
      }

      if (socket.data && socket.data.hardwareId) {
        await deviceCommandQueue.dispatchPendingCommands(socket.data.hardwareId);
      }
    } catch (ackError) {
      logger.warn('Socket.IO command acknowledgement failed', {
        commandId,
        error: ackError && ackError.message ? ackError.message : ackError,
      });
    }
  };

  socket.on('device:register', async (payload = {}) => {
    const hardwareId = payload.deviceId || payload.hardwareId || payload.id;
    if (!hardwareId) {
      return;
    }
    await deviceCommandQueue.registerSocket(String(hardwareId).trim(), socket, payload.metadata || {});
  });

  socket.on('command:ack', (payload) => handleAckEvent(payload, null));
  socket.on('command:ok', (payload) => handleAckEvent(payload, true));
  socket.on('command:error', (payload) => handleAckEvent(payload, false));

  socket.on('disconnect', () => {
    const hardwareId = socket.data && socket.data.hardwareId ? socket.data.hardwareId : null;
    deviceCommandQueue.deregisterSocket(hardwareId, socket);
    logger.info('Socket.IO client disconnected', { socketId: socket.id, hardwareId });
  });
});

// WebSocket setup for real-time data
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
global.wsConnections = new Set();
// Optional mapping from deviceId -> ws connection (when ESP32 registers itself)
global.deviceSockets = new Map();

deviceCommandQueue.startCommandRetryLoop();

wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');
  global.wsConnections.add(ws);
  // allow ws clients (ESP32) to register with a deviceId by sending a JSON message:
  // { type: 'register', deviceId: 'esp32-1' }
  ws.on('message', (raw) => {
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
      if (msg && msg.type === 'register' && msg.deviceId) {
        ws.deviceId = msg.deviceId;
        global.deviceSockets.set(msg.deviceId, ws);
        logger.debug('WebSocket client registered', { deviceId: msg.deviceId });
      }
    } catch (e) {
      // ignore non-JSON or unexpected messages
    }
  });
  
  ws.on('close', () => {
    if (process.env.NODE_ENV !== 'test') {
      logger.info('WebSocket connection closed');
    }
    global.wsConnections.delete(ws);
    if (ws && ws.deviceId && global.deviceSockets.get(ws.deviceId) === ws) {
      global.deviceSockets.delete(ws.deviceId);
    }
  });
  
  ws.on('error', (error) => {
    logger.warn('WebSocket error', error);
    global.wsConnections.delete(ws);
  });
});

// Security middleware
app.use(helmet());
app.use(compression());

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/admin/login', adminAuthLimiter);
app.use('/api/admin/forgot-password', adminAuthLimiter);

// Friendly JSON parse error handler: body-parser throws a SyntaxError which would
// surface to the generic error handler. Catch it early and return a clear 400
// without crashing or producing confusing stack traces in logs.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    logger.warn('JSON parse failed for request', req.method, req.originalUrl, 'raw body begins with:', (req && req.body && typeof req.body === 'string') ? req.body.slice(0,80) : typeof req.body);
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
  }
  next(err);
});

if (schemaReady && typeof schemaReady.then === 'function') {
  app.use(async (req, res, next) => {
    try {
      await schemaReady;
      next();
    } catch (err) {
      next(err);
    }
  });
}


// Sequelize/Postgres: No MongoDB connection needed
// Database is initialized via Sequelize models and scripts

const buildHealthPayload = () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: Date.now(),
});

app.get('/health', (req, res) => {
  res.status(200).json(buildHealthPayload());
});

app.get('/api/health', (req, res) => {
  res.status(200).json(buildHealthPayload());
});

// Lightweight internal ping for debugging connectivity (temporary)
app.get('/internal/ping', (req, res) => {
  res.status(200).send('pong');
});

app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/actuators', actuatorRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/device-commands', deviceCommandRoutes);
app.use('/api/command', commandRoutes);
// Admin authentication + management routes
const adminAuthRoutes = require('./routes/adminAuth');
app.use('/api/admin', adminAuthRoutes);
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Devices (heartbeats) route
const devicesRoutes = require('./routes/devices');
app.use('/api/devices', devicesRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/actuators', actuatorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/actuator', actuatorControlRoutes);

// Serve frontend production build if available (useful in local dev)
try {
  const fs = require('fs');
  const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
  if (fs.existsSync(frontendBuild)) {
    logger.info('Found frontend build, serving static files from', frontendBuild);
    app.use(express.static(frontendBuild));
    // Serve index.html for SPA routes (admin/dashboard, login, etc.)
    app.get(['/','/login','/admin','/admin/*','/dashboard','/admin/dashboard'], (req, res) => {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    });
  }
} catch (e) {
  logger.warn('Could not enable static frontend serving:', e && e.message ? e.message : e);
}

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});
// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
// Default to 8000 as requested for new deployments; keep override via PORT env var
const PORT = process.env.PORT || 10000;

// Bind to 0.0.0.0 in development so localhost resolves (IPv4/IPv6) from browsers reliably
const BIND_HOST = (process.env.BIND_HOST || '0.0.0.0');

// Resilient binding: try PORT and fall back across a small range if the port is in use
const configuredPort = Number(process.env.PORT || PORT || 10000);
const MAX_TRIES = 10;
let attempts = 0;

function onBound(boundPort) {
  if ((process.env.NODE_ENV || 'development') !== 'test') {
    logger.info('Server running', { port: boundPort });
    logger.info('Health check endpoint ready', { url: `http://localhost:${boundPort}/api/health` });
    logger.info('WebSocket server running', { url: `ws://localhost:${boundPort}` });
    try {
      const addr = server.address();
      logger.debug('Server process info', { pid: process.pid, address: addr });
    } catch (e) {
      logger.warn('Could not determine server address/pid:', e && e.message ? e.message : e);
    }

    // Self-check the internal ping endpoint using the actual bound port
    try {
      const http = require('http');
      const selfOpts = {
        hostname: '127.0.0.1',
        port: boundPort,
        path: '/internal/ping',
        method: 'GET',
        timeout: 2000
      };
      const req = http.request(selfOpts, (res) => {
        let body = '';
        res.on('data', (c) => body += c.toString());
        res.on('end', () => {
          logger.debug('Self-check response', { statusCode: res.statusCode, body: body && body.toString().slice(0, 200) });
        });
      });
      req.on('error', (err) => {
        logger.warn('Self-check error connecting to local HTTP endpoint (this can be normal during startup):', err && err.message ? err.message : err);
      });
      req.on('timeout', () => {
        logger.warn('Self-check timed out connecting to local HTTP endpoint (this can be normal during startup)');
        req.destroy();
      });
      req.end();
    } catch (e) {
      logger.error('Self-check setup failed:', e && e.message ? e.message : e);
    }
  }
}

function tryListen(port) {
  attempts++;
  server.listen(port, BIND_HOST, () => onBound(port));
  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} in use (EADDRINUSE)`);
      server.removeAllListeners('error');
      if (attempts < MAX_TRIES) {
        const next = port + 1;
        logger.info(`Attempting to bind to port ${next} (try ${attempts + 1}/${MAX_TRIES})`);
        tryListen(next);
      } else {
        logger.error('Exhausted port retry attempts. Continuing in development mode.');
        if ((process.env.NODE_ENV || 'development') === 'production') {
          process.exit(1);
        }
      }
    } else {
      logger.error('Server listen error', err);
      logger.warn('Continuing to run despite server error (development mode)');
      // Don't exit in development - just log the error
      if ((process.env.NODE_ENV || 'development') === 'production') {
        process.exit(1);
      }
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection captured', { reason, promise });
  // Don't exit in development
  if ((process.env.NODE_ENV || 'development') === 'production') {
    process.exit(1);
  }
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  // Don't exit in development
  if ((process.env.NODE_ENV || 'development') === 'production') {
    process.exit(1);
  }
});

// In development, run seed-admin as a non-blocking child process to ensure admin exists
if ((process.env.NODE_ENV || 'development') !== 'production') {
  try {
    // Temporarily disabled seeding to prevent server exit
    // const { spawn } = require('child_process');
    // const seedPath = path.join(__dirname, 'scripts', 'seed-admin.js');
    // const seedProc = spawn(process.execPath, [seedPath], { stdio: 'ignore', detached: true });
    // seedProc.unref();
    logger.info('Dev seeding process disabled (temporary fix)');
  } catch (e) {
    logger.warn('Could not launch dev seeding process:', e && e.message ? e.message : e);
  }
}

// Optionally start the sensor poller inline when RUN_POLLER is enabled.
// This keeps the poller in-process for simple local dev flows and PM2 will manage it when desired.
if (process.env.RUN_POLLER === 'true' || process.env.RUN_POLLER === '1') {
  try {
    const poller = require('./services/sensor-poller');
    const internalPort = process.env.POLLER_INTERNAL_PORT ? Number(process.env.POLLER_INTERNAL_PORT) : (process.env.INTERNAL_PORT ? Number(process.env.INTERNAL_PORT) : 3100);
    // start the internal HTTP server for poller metrics
    try {
      poller.startServer(internalPort);
      logger.info(`Started sensor poller internal server on port ${internalPort}`);
    } catch (e) {
      logger.warn('Sensor poller internal server failed to start:', e && e.message ? e.message : e);
    }

    // start the polling loop (non-blocking)
    poller.runLoop().catch((err) => {
      logger.error('Sensor poller loop exited with error:', err && err.message ? err.message : err);
    });
    logger.info('Sensor poller started (runLoop)');
  } catch (e) {
    logger.warn('Could not start sensor poller inline:', e && e.message ? e.message : e);
  }
}

module.exports = app;
// Export the http server as a property to allow tests to close it gracefully
module.exports.server = server;

// Simple server startup for development
if ((process.env.NODE_ENV || 'development') !== 'test') {
  const shouldSchedule = (process.env.NODE_ENV || 'development') !== 'test';

  connectDB()
    .then(async () => {
      try {
        await ensureDefaultActuators();
      } catch (error) {
        logger.warn('Server startup: unable to ensure actuators exist:', error && error.message ? error.message : error);
      }

      if (shouldSchedule) {
        scheduleAutomaticControl();
      }
    })
    .catch((error) => {
      logger.error('Database connection failed at startup:', error && error.message ? error.message : error);
      if ((process.env.NODE_ENV || 'development') === 'production') {
        process.exit(1);
      } else {
        logger.warn('Continuing to start server without database connectivity; routes that require the database may fail until it reconnects.');
      }
    })
    .finally(() => {
      tryListen(configuredPort);
    });
} else {
  // In test mode, bind server to the port immediately but avoid console logs
  const testPort = process.env.PORT ? Number(process.env.PORT) : 0;
  server.listen(testPort, '0.0.0.0');
}
