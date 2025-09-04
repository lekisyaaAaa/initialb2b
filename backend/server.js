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
        // In development, sync models lightly to ensure schema compatibility (no force)
        if ((process.env.NODE_ENV || 'development') !== 'production') {
          try {
            await sequelize.sync();
          } catch (e) {
            console.warn('Model sync warning:', e && e.message ? e.message : e);
          }
        }

        // Seed admin user in development if it doesn't exist
        try {
          if ((process.env.NODE_ENV || 'development') !== 'production') {
            const bcrypt = require('bcryptjs');
            const User = require('./models/User');
            const adminUser = process.env.LOCAL_ADMIN_USER || 'admin';
            const adminPass = process.env.LOCAL_ADMIN_PASS || 'admin123';
            const [user, created] = await User.findOrCreate({
              where: { username: adminUser },
              defaults: { password: bcrypt.hashSync(adminPass, 10), role: 'admin' }
            });
            if (created) {
              console.log(`\u2705 Created dev admin user '${adminUser}'`);
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

module.exports = app;
