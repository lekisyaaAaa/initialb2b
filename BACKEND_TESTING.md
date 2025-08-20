# Backend Testing Guide

## 🚀 Quick Start Test

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Start the Server
```bash
npm run dev
```

**Expected Output:**
```
✅ Connected to MongoDB
🚀 Server running on port 5000
📊 Health check: http://localhost:5000/api/health
🔌 WebSocket server running on ws://localhost:5000
✅ Default admin user created
✅ Default user created
✅ Database initialization completed
```

### Step 3: Test Health Check
Open browser or use curl:
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-08-02T...",
  "uptime": 5.123,
  "environment": "development"
}
```

## 🔐 Authentication Testing

### Test Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "username": "admin",
      "role": "admin",
      "lastLogin": "2025-08-02T..."
    }
  }
}
```

### Test User Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user",
    "password": "user"
  }'
```

## 📊 Sensor Data Testing

### Submit Test Sensor Data (Simulating ESP32)
```bash
curl -X POST http://localhost:5000/api/sensors \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ESP32_001",
    "temperature": 25.5,
    "humidity": 60.0,
    "moisture": 45.0,
    "batteryLevel": 85.0,
    "signalStrength": -45
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Sensor data received successfully",
  "data": {
    "sensorData": {
      "_id": "...",
      "deviceId": "ESP32_001",
      "temperature": 25.5,
      "humidity": 60.0,
      "moisture": 45.0,
      "batteryLevel": 85,
      "signalStrength": -45,
      "timestamp": "2025-08-02T...",
      "status": "normal"
    },
    "alertsCreated": 0
  }
}
```

### Get Latest Sensor Data
```bash
curl http://localhost:5000/api/sensors/latest
```

### Test High Temperature Alert
```bash
curl -X POST http://localhost:5000/api/sensors \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ESP32_001",
    "temperature": 35.0,
    "humidity": 60.0,
    "moisture": 45.0
  }'
```

**Should create temperature alert (alertsCreated: 1)**

## 🔔 Alerts Testing

### Get Recent Alerts (Requires Authentication)
```bash
# First get a token from login, then:
curl http://localhost:5000/api/alerts/recent \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## ⚙️ Settings Testing (Admin Only)

### Get Current Settings
```bash
curl http://localhost:5000/api/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

### Update Temperature Threshold
```bash
curl -X PUT http://localhost:5000/api/settings/thresholds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -d '{
    "temperature": {
      "warning": 28,
      "critical": 32
    }
  }'
```

## 🌐 WebSocket Testing

### Using Browser Console
```javascript
const ws = new WebSocket('ws://localhost:5000');
ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

Then submit sensor data via API and watch real-time updates!

## 🔍 Common Issues & Solutions

### ❌ "MongoDB connection error"
**Solutions:**
1. **Local MongoDB:** Install and start MongoDB service
2. **MongoDB Atlas:** Update MONGODB_URI in .env with your Atlas connection string
3. **Connection String:** Ensure format is correct and credentials are valid

### ❌ "Port already in use"
**Solutions:**
1. Change PORT in .env file
2. Kill existing process: `netstat -ano | findstr :5000` then `taskkill /PID <PID> /F`

### ❌ "Cannot POST /api/sensors"
**Check:**
1. Server is running
2. Content-Type header is set
3. JSON syntax is valid

### ❌ "Token required" errors
**Solution:**
1. Login first to get token
2. Include Authorization header: `Bearer <token>`

## 📋 Complete Test Checklist

- [ ] Health check responds with status OK
- [ ] Admin login returns valid JWT token
- [ ] User login returns valid JWT token  
- [ ] Sensor data submission works
- [ ] Latest sensor data retrieval works
- [ ] High values trigger alerts
- [ ] WebSocket broadcasts sensor data
- [ ] Protected routes require authentication
- [ ] Admin-only routes reject user tokens
- [ ] Settings can be retrieved and updated

## 🛠️ Advanced Testing

### Load Testing (Optional)
```bash
# Install artillery
npm install -g artillery

# Create test-config.yml
artillery quick --count 10 --num 5 http://localhost:5000/api/health
```

### Database Inspection
```bash
# If using local MongoDB
mongo
use environmental_monitoring
db.sensordatas.find().limit(5)
db.alerts.find().limit(5)
db.users.find()
```

## 🎯 Success Indicators

Your backend is working correctly if:
1. ✅ Server starts without errors
2. ✅ Health check returns 200 OK
3. ✅ Authentication works for both admin/user
4. ✅ Sensor data can be submitted and retrieved
5. ✅ Alerts are created for threshold violations
6. ✅ WebSocket broadcasts real-time data
7. ✅ Protected routes work properly
8. ✅ Database operations succeed

---

**Next Steps:** Once backend is confirmed working, we can build the React frontend!
