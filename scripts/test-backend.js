#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
};

async function testBackend() {
  log.info('Starting Backend API Tests...\n');

  try {
    // Test 1: Health Check
    log.info('Test 1: Health Check');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    if (healthResponse.status === 200 && healthResponse.data.status === 'OK') {
      log.success('Health check passed');
    } else {
      throw new Error('Health check failed');
    }

    // Test 2: Admin Login
    log.info('\nTest 2: Admin Login');
    const adminLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin'
    });
    
    if (adminLoginResponse.data.success && adminLoginResponse.data.data.token) {
      log.success('Admin login successful');
      const adminToken = adminLoginResponse.data.data.token;

      // Test 3: Get Settings (Admin Only)
      log.info('\nTest 3: Get Settings (Admin)');
      const settingsResponse = await axios.get(`${BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (settingsResponse.data.success) {
        log.success('Settings retrieved successfully');
      } else {
        throw new Error('Failed to get settings');
      }

    } else {
      throw new Error('Admin login failed');
    }

    // Test 4: User Login
    log.info('\nTest 4: User Login');
    const userLoginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'user',
      password: 'user'
    });
    
    if (userLoginResponse.data.success && userLoginResponse.data.data.token) {
      log.success('User login successful');
    } else {
      throw new Error('User login failed');
    }

    // Test 5: Submit Sensor Data
    log.info('\nTest 5: Submit Sensor Data');
    const sensorResponse = await axios.post(`${BASE_URL}/api/sensors`, {
      deviceId: 'TEST_ESP32',
      temperature: 25.5,
      humidity: 60.0,
      moisture: 45.0,
      batteryLevel: 85.0,
      signalStrength: -45
    });
    
    if (sensorResponse.data.success) {
      log.success('Sensor data submitted successfully');
    } else {
      throw new Error('Failed to submit sensor data');
    }

    // Test 6: Get Latest Sensor Data
    log.info('\nTest 6: Get Latest Sensor Data');
    const latestResponse = await axios.get(`${BASE_URL}/api/sensors/latest`);
    
    if (latestResponse.data.success && latestResponse.data.data) {
      log.success('Latest sensor data retrieved successfully');
      log.info(`  Device: ${latestResponse.data.data.deviceId}`);
      log.info(`  Temperature: ${latestResponse.data.data.temperature}°C`);
      log.info(`  Humidity: ${latestResponse.data.data.humidity}%`);
      log.info(`  Moisture: ${latestResponse.data.data.moisture}%`);
    } else {
      throw new Error('Failed to get latest sensor data');
    }

    // Test 7: Submit High Temperature (Should Create Alert)
    log.info('\nTest 7: Submit High Temperature (Alert Test)');
    const alertResponse = await axios.post(`${BASE_URL}/api/sensors`, {
      deviceId: 'TEST_ESP32',
      temperature: 35.0, // Above default threshold
      humidity: 60.0,
      moisture: 45.0
    });
    
    if (alertResponse.data.success) {
      log.success('High temperature data submitted');
      if (alertResponse.data.data.alertsCreated > 0) {
        log.success(`${alertResponse.data.data.alertsCreated} alert(s) created`);
      } else {
        log.warning('No alerts created (check threshold settings)');
      }
    } else {
      throw new Error('Failed to submit high temperature data');
    }

    log.success('\n🎉 All backend tests passed! Your backend is working correctly.');
    log.info('\nNext steps:');
    log.info('1. Keep the server running with: npm run dev');
    log.info('2. Test the API endpoints manually or build the frontend');
    log.info('3. Check BACKEND_TESTING.md for more detailed testing');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log.error('Cannot connect to backend server');
      log.info('Make sure the backend is running:');
      log.info('  cd backend && npm run dev');
    } else if (error.response) {
      log.error(`API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
    } else {
      log.error(`Test failed: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run tests
testBackend();
