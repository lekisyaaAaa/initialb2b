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
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { validateEnv } = require('./utils/validateEnv');
validateEnv();
const database = require('./services/database_pg');
const sequelize = database;
const connectDB = typeof sequelize.connectDB === 'function' ? sequelize.connectDB : async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected (fallback connectDB)');
  } catch (error) {
    console.error('❌ Database connection failed during fallback connectDB:', error.message);
    throw error;
  }
};
const { ensureDatabaseSetup } = database;
const schemaReady = ensureDatabaseSetup({ force: (process.env.NODE_ENV || 'development') === 'test' });
const {
  ensureDefaultActuators,
  listActuators,
  scheduleAutomaticControl,
} = require('./services/actuatorService');

// Import routes
const authRoutes = require('./routes/auth');
const sensorRoutes = require('./routes/sensors');
const alertRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const actuatorRoutes = require('./routes/actuators');
const maintenanceRoutes = require('./routes/maintenance');
const notificationRoutes = require('./routes/notifications');
const actuatorControlRoutes = require('./routes/actuatorControl');

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
const socketCorsOrigins = (process.env.SOCKETIO_CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProductionEnv) return callback(null, true);
      if (socketCorsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Socket origin not allowed'));
    },
    credentials: true,
  },
  serveClient: false,
  transports: ['websocket', 'polling'],
});

global.io = io;

io.on('connection', async (socket) => {
  console.log('Socket.IO client connected', socket.id);
  try {
    const actuators = await listActuators();
    socket.emit('actuator_snapshot', actuators);
    // Backward compatibility during migration
    socket.emit('actuatorSnapshot', actuators);
  } catch (error) {
    socket.emit('actuator_snapshot', []);
    socket.emit('actuatorSnapshot', []);
  }

  socket.on('disconnect', () => {
    console.log('Socket.IO client disconnected', socket.id);
  });
});

// WebSocket setup for real-time data
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
global.wsConnections = new Set();
// Optional mapping from deviceId -> ws connection (when ESP32 registers itself)
global.deviceSockets = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  global.wsConnections.add(ws);
  // allow ws clients (ESP32) to register with a deviceId by sending a JSON message:
  // { type: 'register', deviceId: 'esp32-1' }
  ws.on('message', (raw) => {
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
      if (msg && msg.type === 'register' && msg.deviceId) {
        ws.deviceId = msg.deviceId;
        global.deviceSockets.set(msg.deviceId, ws);
        console.log(`WebSocket client registered as deviceId=${msg.deviceId}`);
      }
    } catch (e) {
      // ignore non-JSON or unexpected messages
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    global.wsConnections.delete(ws);
    if (ws && ws.deviceId && global.deviceSockets.get(ws.deviceId) === ws) {
      global.deviceSockets.delete(ws.deviceId);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    global.wsConnections.delete(ws);
  });
});

// Security middleware
app.use(helmet());
app.use(compression());

app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

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
    console.warn('JSON parse failed for request', req.method, req.originalUrl, 'raw body begins with:', (req && req.body && typeof req.body === 'string') ? req.body.slice(0,80) : typeof req.body);
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

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
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
    console.log('Found frontend build, serving static files from', frontendBuild);
    app.use(express.static(frontendBuild));
    // Serve index.html for SPA routes (admin/dashboard, login, etc.)
    app.get(['/','/login','/admin','/admin/*','/dashboard','/admin/dashboard'], (req, res) => {
      res.sendFile(path.join(frontendBuild, 'index.html'));
    });
  }
} catch (e) {
  console.warn('Could not enable static frontend serving:', e && e.message ? e.message : e);
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
const PORT = process.env.PORT || 8000;

// Bind to 0.0.0.0 in development so localhost resolves (IPv4/IPv6) from browsers reliably
const BIND_HOST = (process.env.BIND_HOST || '0.0.0.0');

// Resilient binding: try PORT and fall back across a small range if the port is in use
const configuredPort = Number(process.env.PORT || PORT || 8000);
const MAX_TRIES = 10;
let attempts = 0;

function onBound(boundPort) {
  if ((process.env.NODE_ENV || 'development') !== 'test') {
    console.log(`🚀 Server running on port ${boundPort}`);
    console.log(`📊 Health check: http://localhost:${boundPort}/api/health`);
    console.log(`🔌 WebSocket server running on ws://localhost:${boundPort}`);
    try {
      console.log('Process PID:', process.pid);
      const addr = server.address();
      console.log('Server bound address:', addr);
    } catch (e) {
      console.warn('Could not determine server address/pid:', e && e.message ? e.message : e);
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
          console.log('Self-check: response', res.statusCode, body && body.toString().slice(0,200));
        });
      });
      req.on('error', (err) => {
        console.warn('Self-check: error connecting to local HTTP endpoint (this is normal during startup):', err && err.message ? err.message : err);
      });
      req.on('timeout', () => {
        console.warn('Self-check: timed out connecting to local HTTP endpoint (this is normal during startup)');
        req.destroy();
      });
      req.end();
    } catch (e) {
      console.error('Self-check setup failed:', e && e.message ? e.message : e);
    }
  }
}

function tryListen(port) {
  attempts++;
  server.listen(port, BIND_HOST, () => onBound(port));
  server.once('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use (EADDRINUSE)`);
      server.removeAllListeners('error');
      if (attempts < MAX_TRIES) {
        const next = port + 1;
        console.log(`Attempting to bind to port ${next} (try ${attempts + 1}/${MAX_TRIES})`);
        tryListen(next);
      } else {
        console.error('Exhausted port retry attempts. Continuing in development mode.');
        if ((process.env.NODE_ENV || 'development') === 'production') {
          process.exit(1);
        }
      }
    } else {
      console.error('Server listen error:', err);
      console.warn('Continuing to run despite server error (development mode)');
      // Don't exit in development - just log the error
      if ((process.env.NODE_ENV || 'development') === 'production') {
        process.exit(1);
      }
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in development
  if ((process.env.NODE_ENV || 'development') === 'production') {
    process.exit(1);
  }
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
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
    console.log('Dev seeding process disabled (temporary fix)');
  } catch (e) {
    console.warn('Could not launch dev seeding process:', e && e.message ? e.message : e);
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
      console.log(`Started sensor poller internal server on port ${internalPort}`);
    } catch (e) {
      console.warn('Sensor poller internal server failed to start:', e && e.message ? e.message : e);
    }

    // start the polling loop (non-blocking)
    poller.runLoop().catch((err) => {
      console.error('Sensor poller loop exited with error:', err && err.message ? err.message : err);
    });
    console.log('Sensor poller started (runLoop)');
  } catch (e) {
    console.warn('Could not start sensor poller inline:', e && e.message ? e.message : e);
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
        console.warn('Server startup: unable to ensure actuators exist:', error && error.message ? error.message : error);
      }

      if (shouldSchedule) {
        scheduleAutomaticControl();
      }
    })
    .catch((error) => {
      console.error('❌ Database connection failed at startup:', error && error.message ? error.message : error);
      if ((process.env.NODE_ENV || 'development') === 'production') {
        process.exit(1);
      } else {
        console.warn('Continuing to start server without database connectivity; routes that require the database may fail until it reconnects.');
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
