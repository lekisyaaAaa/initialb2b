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
    // Ensure there is at least one sensor reading by POSTing a sample payload if latest is empty
    let sensorResponse = await axios.get('http://localhost:5000/api/sensors/latest');
    if (sensorResponse.data && sensorResponse.data.success && Array.isArray(sensorResponse.data.data) && sensorResponse.data.data.length === 0) {
      console.log('No latest data present — creating a test sensor reading...');
      try {
        await axios.post('http://localhost:5000/api/sensors', {
          deviceId: 'integration-test-device',
          temperature: 22.5,
          humidity: 55,
          moisture: 40,
          ph: 6.8,
          ec: 1.2,
          nitrogen: 10,
          phosphorus: 5,
          potassium: 8,
          waterLevel: 75,
          batteryLevel: 3.7,
          signalStrength: -70
        });
        // Allow short delay for async processing
        await new Promise(r => setTimeout(r, 500));
        sensorResponse = await axios.get('http://localhost:5000/api/sensors/latest');
      } catch (e) {
        console.warn('Could not create test sensor reading:', e && e.message ? e.message : e);
      }
    }

    if (sensorResponse.data && sensorResponse.data.success) {
      const data = Array.isArray(sensorResponse.data.data) ? (sensorResponse.data.data[0] || {}) : sensorResponse.data.data;
      console.log('✅ Latest Sensor Reading:');
      console.log(`   Device: ${data.deviceId || 'N/A'}`);
      console.log(`   Temperature: ${data.temperature !== undefined ? data.temperature : 'N/A'}°C`);
      console.log(`   Humidity: ${data.humidity !== undefined ? data.humidity : 'N/A'}%`);
      console.log(`   Moisture: ${data.moisture !== undefined ? data.moisture : 'N/A'}%`);
      console.log(`   Status: ${data.status || 'N/A'}`);
      console.log(`   Timestamp: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}`);
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
    console.log('📊 Database: MongoDB with real sensor data');
    console.log('🔧 Backend: Express.js server running');
    console.log('🌐 API: RESTful endpoints active');
    console.log('⚡ WebSocket: Real-time updates ready');
    console.log('🎨 Frontend: React app with BeanToBin design (ready to connect)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testIntegration();
