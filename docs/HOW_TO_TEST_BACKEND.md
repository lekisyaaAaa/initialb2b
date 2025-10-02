# 🔧 How to Test Your Backend - Step by Step

## Prerequisites Checklist
Before testing, ensure you have:
- [ ] Node.js installed (v16 or higher)
- [ ] PostgreSQL running (local or Docker)
- [ ] Git Bash or PowerShell

## 🚀 Method 1: Quick Automated Test

### Step 1: Install Dependencies
```bash
# From the main project directory
npm install
cd backend
npm install
```

### Step 2: Setup Environment
```bash
# Copy the example environment file
cp .env.example .env
# Edit .env and set DATABASE_URL to your Postgres connection string
```

### Step 3: Start Backend Server
```bash
# From backend directory
npm run dev
```

**✅ Success Signs:**
```
✅ Connected to PostgreSQL (Sequelize)
🚀 Server running on port 5000
📊 Health check: http://localhost:5000/api/health
🔌 WebSocket server running on ws://localhost:5000
✅ Default admin user created
✅ Default user created
✅ Database initialization completed
```

### Step 4: Run Automated Tests
```bash
# Open new terminal, from main directory
npm run test-backend
```

**✅ All tests should pass with green checkmarks!**

---

## 🗄️ Database Setup (PostgreSQL)

Use PostgreSQL as the canonical database. Run Postgres locally or with Docker. Example using Docker Compose (recommended for local development):

1. Create or update `docker-compose.yml` with a Postgres service (image: postgres:15-alpine).
2. Start the database:
```powershell
docker compose up -d
```
3. Update `backend/.env` with your DATABASE_URL connection string, e.g.:
```env
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/beantobin
```

Note: Historical migration helpers that referenced MongoDB were moved to `backend/legacy_migrations/` for archival use only.

---

## 🧪 Method 2: Manual Testing

### Test 1: Health Check
**Browser:** Go to http://localhost:5000/api/health

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get
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

### Test 2: Login
**PowerShell:**
```powershell
$loginData = @{
    username = "admin"
    password = "admin"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -Body $loginData -ContentType "application/json"
$token = $response.data.token
Write-Output "Token: $token"
```

### Test 3: Submit Sensor Data
**PowerShell:**
```powershell
$sensorData = @{
    deviceId = "ESP32_001"
    temperature = 25.5
    humidity = 60.0
    moisture = 45.0
    batteryLevel = 85.0
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/sensors" -Method Post -Body $sensorData -ContentType "application/json"
```

### Test 4: Get Latest Data
**Browser:** Go to http://localhost:5000/api/sensors/latest

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/sensors/latest" -Method Get
```

---

## 🔍 Troubleshooting

### Problem: "ECONNREFUSED" or "Cannot connect"
**Solution:**
1. Make sure backend server is running (`npm run dev`)
2. Check if port 5000 is available
3. Verify no firewall blocking

### Problem: "Database connection error"
**Solutions:**
1. Ensure `DATABASE_URL` in `backend/.env` is correct and properly URL-encoded
2. If using Docker, confirm Postgres container is running: `docker ps` and check logs: `docker compose logs db`
3. Check firewall or port binding issues and verify credentials

### Problem: "ValidationError" or "400 Bad Request"
**Solution:**
1. Check JSON syntax in request body
2. Ensure all required fields are provided
3. Verify data types (numbers vs strings)

### Problem: "Unauthorized" or "401"
**Solution:**
1. Login first to get a valid token
2. Include Authorization header: `Bearer <token>`
3. Check token hasn't expired (24h default)

---

## 📊 What Each Test Proves

| Test | What It Verifies |
|------|------------------|
| Health Check | Server is running and responding |
| Admin Login | Authentication system works |
| User Login | Role-based access is configured |
| Sensor Data | Database writes are working |
| Latest Data | Database reads are working |
| High Temperature | Alert system is functional |
| Settings Access | Authorization is working |

---

## 🎯 Success Criteria

Your backend is **100% working** if:

✅ **Server starts** without errors  
✅ **Health check** returns status OK  
✅ **Login works** for both admin and user  
✅ **Sensor data** can be submitted and retrieved  
✅ **Alerts are created** for high values  
✅ **Database** operations succeed  
✅ **WebSocket** broadcasts data  

---

## 🚀 Next Steps

Once your backend is confirmed working:

1. **Keep it running**: `npm run backend`
2. **Build the frontend**: React dashboard with charts
3. **Test real-time features**: WebSocket connections
4. **Add SMS alerts**: Twilio integration
5. **Create ESP32 code**: Hardware integration

**Ready to continue?** Let me know when your backend tests pass and we'll build the React frontend! 🚀
