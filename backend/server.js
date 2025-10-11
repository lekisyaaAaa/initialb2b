const express = require('express');
// Mongoose removed. Using Sequelize/Postgres only.
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import routes
const authRoutes = require('./routes/auth');
const sensorRoutes = require('./routes/sensors');
const alertRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const actuatorRoutes = require('./routes/actuators');
const maintenanceRoutes = require('./routes/maintenance');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

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

// Development Content Security Policy helper: allow local API origins for SPA served from the backend
if ((process.env.NODE_ENV || 'development') !== 'production') {
  app.use((req, res, next) => {
    // Allow connections to localhost and 127.0.0.1 for API and WebSocket during local dev
    const csp = "default-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 ws://localhost:5000 ws://127.0.0.1:5000;";
    res.setHeader('Content-Security-Policy', csp);
    next();
  });
}

// Rate limiting - disabled for development
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use('/api/', limiter); // Disabled for development

// CORS configuration - allow common local dev origins dynamically to avoid brittle lists
const corsOptions = {
  origin: function(origin, callback) {
    // If no origin (e.g., same-origin or curl), allow it
    if (!origin) return callback(null, true);
    // Allow explicit list from env if provided
    if (process.env.CORS_ORIGINS) {
      const allowed = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
      if (allowed.includes(origin)) return callback(null, true);
    }
    // Allow localhost and 127.0.0.1 on any port during development
    try {
      const u = new URL(origin);
      // allow IPv4 and IPv6 localhost variants during development
      const hostname = u.hostname;
      if ((hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') && (process.env.NODE_ENV || 'development') !== 'production') {
        return callback(null, true);
      }
    } catch (e) {
      // ignore parse errors and fallthrough
    }
    // Fallback: block other origins
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

  
    // Initialize Postgres and seed a development admin user if possible.
    // Temporarily disabled for testing
    /*
    (async () => {
      const sequelize = require('./services/database_pg');
      try {
        await sequelize.authenticate();
        console.log('\u2705 Connected to Postgres (Sequelize)');
        // In development, attempt to update the SQLite schema to reflect model changes.
        // Use `alter: true` so we don't drop data but apply column changes.
        if ((process.env.NODE_ENV || 'development') !== 'production') {
          try {
            await sequelize.sync({ alter: true });
            console.log('\u2705 Sequelize models synced (alter: true)');
          } catch (e) {
            console.warn('Model sync warning (alter):', e && e.message ? e.message : e);
          }
        }

        // Seed admin user in development if it doesn't exist
        try {
          if ((process.env.NODE_ENV || 'development') !== 'production') {
            const bcrypt = require('bcryptjs');
            const User = require('./models/User');
            const adminUser = process.env.LOCAL_ADMIN_USER || 'beantobin';
            const adminPass = process.env.LOCAL_ADMIN_PASS || 'Bean2bin';
            // Ensure admin user exists and has the expected dev password (helpful for local testing)
            let user = await User.findOne({ where: { username: adminUser } });
            if (!user) {
              user = await User.create({ username: adminUser, password: bcrypt.hashSync(adminPass, 10), role: 'admin' });
              console.log(`\u2705 Created dev admin user '${adminUser}'`);
            } else {
              // Update password/role to match expected dev credentials to avoid mismatch across docs
              try {
                user.password = bcrypt.hashSync(adminPass, 10);
                user.role = 'admin';
                await user.save();
                console.log(`\u2705 Ensured dev admin user '${adminUser}' password/role are up-to-date`);
              } catch (e) {
                console.warn('Could not update dev admin credentials:', e && e.message ? e.message : e);
              }
            }
          }
        } catch (seedErr) {
          console.warn('Could not seed admin user:', seedErr && seedErr.message ? seedErr.message : seedErr);
        }
      } catch (err) {
        console.warn('\u26A0\uFE0F Postgres initialization failed - running without DB:', err && err.message ? err.message : err);
      }
    })();
    */
// In development, prefer a permissive CORS policy to avoid brittle origin checks
if ((process.env.NODE_ENV || 'development') !== 'production') {
  console.log('Development mode: enabling permissive CORS for all origins');
  app.use(cors());
} else {
  app.use(cors(corsOptions));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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


// Sequelize/Postgres: No MongoDB connection needed
// Database is initialized via Sequelize models and scripts

// Health check endpoint with database status
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const sequelize = require('./services/database_pg');
    await sequelize.authenticate();

    res.status(200).json({
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        dialect: 'postgresql'
      }
    });
  } catch (dbError) {
    console.error('Health check - Database error:', dbError.message);
    res.status(503).json({
      success: false,
      status: 'Database unavailable',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'disconnected',
        error: dbError.message
      }
    });
  }
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
// Mount admin route for simple admin login (keeps compatibility with existing auth flows)
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

// Improved error diagnostics for common startup issues (EADDRINUSE)
let _triedAlternatePort = false;
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\u26A0\uFE0F Port ${PORT} already in use (EADDRINUSE).`);
    // If we haven't tried an alternate port yet, attempt PORT+1 to allow local dev to continue.
    if (!_triedAlternatePort) {
      const altPort = Number(PORT) + 1;
      console.warn(`Attempting to bind to alternate port ${altPort}...`);
      _triedAlternatePort = true;
      try {
        server.listen(altPort, () => {
          console.log(`🚀 Server running on alternate port ${altPort}`);
          console.log(`📊 Health check: http://localhost:${altPort}/api/health`);
          console.log(`🔌 WebSocket server running on ws://localhost:${altPort}`);
        });
        return;
      } catch (e) {
        console.error('Alternate port bind failed:', e && e.message ? e.message : e);
      }
    }

    try {
      // Try to surface listening process information (Windows-friendly)
      const { execSync } = require('child_process');
      try {
        const netstat = execSync(`netstat -ano | findstr ":${PORT}"`, { encoding: 'utf8' });
        console.error('netstat results for port ' + PORT + ':');
        console.error(netstat);
        const lines = netstat.split(/\r?\n/).filter(Boolean);
        const pids = new Set();
        lines.forEach((line) => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) pids.add(pid);
        });
        for (const pid of pids) {
          try {
            const wmic = execSync(`wmic process where processid=${pid} get ProcessId,CommandLine /format:list`, { encoding: 'utf8' });
            console.error(`Process ${pid} info:`);
            console.error(wmic);
          } catch (e) {
            // ignore per-process failures
          }
        }
      } catch (e) {
        // netstat may not be available on some platforms
        console.error('Could not run netstat/wmic diagnostics:', e && e.message ? e.message : e);
      }
    } catch (e) {
      console.error('Error while collecting diagnostics:', e && e.message ? e.message : e);
    }
    // If we tried alternate and still failing, log warning but don't exit
    console.warn('Port binding failed, but continuing in development mode');
    if ((process.env.NODE_ENV || 'development') === 'production') {
      process.exit(1);
    }
  } else {
    console.error('Server error:', err);
  }
});

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

tryListen(configuredPort);


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
  server.listen(process.env.PORT || 5000, '0.0.0.0', () => {
    const port = process.env.PORT || 5000;
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
  });
} else {
  // In test mode, bind server to the port immediately but avoid console logs
  server.listen(process.env.PORT || 0, '0.0.0.0');
}
