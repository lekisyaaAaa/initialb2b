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

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Initialize Sequelize/Postgres connection and sync models
const sequelize = require('./services/database_pg');
const initializePostgres = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to Postgres (Sequelize)');
    // If you want automatic model sync in development uncomment next line
    // await sequelize.sync({ alter: true });
  } catch (err) {
  // Log the error but do NOT exit the process here.
  // The caller (startup IIFE) will decide how to proceed so the server
  // can run in a degraded mode for frontend testing when Postgres is down.
  console.error('❌ Postgres connection failed:', err);
  throw err;
  }
};

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

// Start server; attempt DB init but do not block server start if DB is down.
(async () => {
  try {
    await initializePostgres();
    console.log('Postgres initialized successfully');
  } catch (err) {
    console.warn('Warning: Postgres initialization failed — starting server without DB:', err && err.message ? err.message : err);
    // Continue without exiting so the frontend can be served for testing/development.
  }

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
  });
})();


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
