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

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// WebSocket setup for real-time data
const wss = new WebSocket.Server({ server });

// Store WebSocket connections
global.wsConnections = new Set();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  global.wsConnections.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    global.wsConnections.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    global.wsConnections.delete(ws);
  });
});

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting - disabled for development
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use('/api/', limiter); // Disabled for development

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
    'http://localhost:3000', 
    'http://localhost:3002',
    'http://localhost:3003',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

  
    // Initialize Postgres and seed a development admin user if possible.
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
            const adminUser = process.env.LOCAL_ADMIN_USER || 'admin';
            const adminPass = process.env.LOCAL_ADMIN_PASS || 'admin';
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
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Sequelize/Postgres: No MongoDB connection needed
// Database is initialized via Sequelize models and scripts

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 5000;

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
    // If we tried alternate and still failing, exit with code
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
});


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// In development, run seed-admin as a non-blocking child process to ensure admin exists
if ((process.env.NODE_ENV || 'development') !== 'production') {
  try {
    const { spawn } = require('child_process');
    const seedPath = path.join(__dirname, 'scripts', 'seed-admin.js');
    const seedProc = spawn(process.execPath, [seedPath], { stdio: 'ignore', detached: true });
    seedProc.unref();
    console.log('Launched dev seeding process (seed-admin.js)');
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
