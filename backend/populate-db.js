const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SensorData = require('./models/SensorData');
const Alert = require('./models/Alert');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    populateDatabase();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

async function populateDatabase() {
  try {
    console.log('🔄 Populating database with sample data...');

    // Clear existing data
    await SensorData.deleteMany({});
    await Alert.deleteMany({});
    console.log('🗑️ Cleared existing data');

    // Generate sample sensor data for the last 24 hours
    const now = new Date();
    const sensorData = [];
    const alerts = [];

    // Generate data points every 30 minutes for the last 24 hours
    for (let i = 0; i < 48; i++) {
      const timestamp = new Date(now.getTime() - (i * 30 * 60 * 1000)); // 30 minutes intervals
      
      // Generate realistic environmental data with some variation
      const baseTemp = 25 + Math.sin(i * 0.26) * 5; // Temperature varies between 20-30°C
      const baseHumidity = 60 + Math.sin(i * 0.15) * 20; // Humidity varies between 40-80%
      const baseMoisture = 40 + Math.sin(i * 0.1) * 30; // Moisture varies between 10-70%

      const temperature = Math.round((baseTemp + (Math.random() - 0.5) * 4) * 10) / 10;
      const humidity = Math.round((baseHumidity + (Math.random() - 0.5) * 10) * 10) / 10;
      const moisture = Math.round((baseMoisture + (Math.random() - 0.5) * 10) * 10) / 10;

      // Determine status based on values
      let status = 'normal';
      if (temperature > 32 || humidity > 85 || moisture < 15) {
        status = 'critical';
      } else if (temperature > 28 || humidity > 75 || moisture < 25) {
        status = 'warning';
      }

      const dataPoint = {
        deviceId: 'BEAN001',
        temperature: Math.max(0, Math.min(50, temperature)),
        humidity: Math.max(0, Math.min(100, humidity)),
        moisture: Math.max(0, Math.min(100, moisture)),
        timestamp,
        status,
        batteryLevel: 85 + Math.floor(Math.random() * 15), // 85-100%
        signalStrength: -50 - Math.floor(Math.random() * 20), // -50 to -70 dBm
        isOfflineData: false
      };

      sensorData.push(dataPoint);

      // Create alerts for critical conditions
      if (status === 'critical') {
        const alertType = temperature > 32 ? 'temperature' : 
                         humidity > 85 ? 'humidity' : 'moisture';
        
        alerts.push({
          deviceId: 'BEAN001',
          type: alertType,
          severity: 'high',
          message: `${alertType.charAt(0).toUpperCase() + alertType.slice(1)} ${
            alertType === 'temperature' ? 'too high' : 
            alertType === 'humidity' ? 'too high' : 'too low'
          }: ${dataPoint[alertType]}${alertType === 'temperature' ? '°C' : '%'}`,
          timestamp,
          isResolved: Math.random() > 0.7, // 30% chance alert is resolved
          resolvedAt: Math.random() > 0.7 ? new Date(timestamp.getTime() + 60 * 60 * 1000) : null // Resolved 1 hour later
        });
      }
    }

    // Add some additional devices
    for (let deviceNum = 2; deviceNum <= 3; deviceNum++) {
      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // Hourly data
        
        const temperature = 22 + Math.random() * 8; // 22-30°C
        const humidity = 50 + Math.random() * 30; // 50-80%
        const moisture = 30 + Math.random() * 40; // 30-70%

        sensorData.push({
          deviceId: `BEAN00${deviceNum}`,
          temperature: Math.round(temperature * 10) / 10,
          humidity: Math.round(humidity * 10) / 10,
          moisture: Math.round(moisture * 10) / 10,
          timestamp,
          status: 'normal',
          batteryLevel: 75 + Math.floor(Math.random() * 25),
          signalStrength: -60 - Math.floor(Math.random() * 30),
          isOfflineData: false
        });
      }
    }

    // Insert sample data
    await SensorData.insertMany(sensorData);
    console.log(`✅ Inserted ${sensorData.length} sensor data points`);

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
      console.log(`✅ Inserted ${alerts.length} alerts`);
    }

    // Create some additional alerts for testing
    const testAlerts = [
      {
        deviceId: 'BEAN002',
        type: 'battery_low',
        severity: 'medium',
        message: 'Device battery level below 20%',
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        isResolved: false
      },
      {
        deviceId: 'BEAN003',
        type: 'device_offline',
        severity: 'high',
        message: 'Device has gone offline',
        timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        isResolved: true,
        resolvedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000)
      }
    ];

    await Alert.insertMany(testAlerts);
    console.log(`✅ Inserted ${testAlerts.length} additional alerts`);

    console.log('🎉 Database population completed successfully!');
    
    // Display summary
    const totalSensorData = await SensorData.countDocuments();
    const totalAlerts = await Alert.countDocuments();
    const unresolvedAlerts = await Alert.countDocuments({ isResolved: false });
    
    console.log('\n📊 Database Summary:');
    console.log(`   📈 Total sensor readings: ${totalSensorData}`);
    console.log(`   🚨 Total alerts: ${totalAlerts}`);
    console.log(`   ⚠️  Unresolved alerts: ${unresolvedAlerts}`);
    console.log(`   📅 Data range: Last 24 hours`);
    console.log(`   🔗 Devices: BEAN001, BEAN002, BEAN003`);

  } catch (error) {
    console.error('❌ Error populating database:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}
