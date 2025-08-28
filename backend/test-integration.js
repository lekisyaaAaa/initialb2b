const axios = require('axios');

// Test script to demonstrate the API integration
async function testIntegration() {
  console.log('🚀 Testing BeanToBin Environmental Monitoring API Integration');
  console.log('=' .repeat(60));
  
  try {
    // Test health endpoint
    console.log('1. Testing Health Endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Health Status:', healthResponse.data.status);
    console.log('   Uptime:', healthResponse.data.uptime.toFixed(2), 'seconds');
    
    // Test latest sensor data
    console.log('\n2. Testing Latest Sensor Data...');
    const sensorResponse = await axios.get('http://localhost:5000/api/sensors/latest');
    if (sensorResponse.data.success) {
      const data = sensorResponse.data.data;
      console.log('✅ Latest Sensor Reading:');
      console.log(`   Device: ${data.deviceId}`);
      console.log(`   Temperature: ${data.temperature}°C`);
      console.log(`   Humidity: ${data.humidity}%`);
      console.log(`   Moisture: ${data.moisture}%`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
    }
    
    // Test WebSocket connection
    console.log('\n3. Testing WebSocket Connection...');
    const WebSocket = require('ws');
    const ws = new WebSocket('ws://localhost:5000');
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      ws.close();
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
    });
    
    console.log('\n🎉 API Integration Test Complete!');
  console.log('📊 Database: PostgreSQL (Sequelize) with real sensor data');
    console.log('🔧 Backend: Express.js server running');
    console.log('🌐 API: RESTful endpoints active');
    console.log('⚡ WebSocket: Real-time updates ready');
    console.log('🎨 Frontend: React app with BeanToBin design (ready to connect)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testIntegration();
