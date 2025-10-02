const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test route for authentication
app.post('/api/test/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin') {
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: 'test_token_123',
        user: {
          username: 'admin',
          role: 'admin'
        }
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Test route for sensor data
app.post('/api/test/sensors', (req, res) => {
  const { deviceId, temperature, humidity, moisture } = req.body;
  
  if (!deviceId || temperature === undefined || humidity === undefined || moisture === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }
  
  // Simulate alert creation
  let alertsCreated = 0;
  const alerts = [];
  
  if (temperature > 30) {
    alerts.push('High temperature alert');
    alertsCreated++;
  }
  
  if (humidity > 80) {
    alerts.push('High humidity alert');
    alertsCreated++;
  }
  
  if (moisture < 20) {
    alerts.push('Low moisture alert');
    alertsCreated++;
  }
  
  res.json({
    success: true,
    message: 'Sensor data received successfully',
    data: {
      sensorData: {
        deviceId,
        temperature,
        humidity,
        moisture,
        timestamp: new Date().toISOString(),
        status: alertsCreated > 0 ? 'warning' : 'normal'
      },
      alertsCreated,
      alerts
    }
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('✅ Test Backend Server Started');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test endpoints available:`);
  console.log(`   POST http://localhost:${PORT}/api/test/login`);
  console.log(`   POST http://localhost:${PORT}/api/test/sensors`);
  console.log('');
  console.log('🔧 Test with:');
  console.log('   curl http://localhost:5000/api/health');
  console.log('');
});
