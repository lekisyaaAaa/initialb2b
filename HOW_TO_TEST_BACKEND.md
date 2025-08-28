# 🔧 How to Test Your Backend - Step by Step

## Prerequisites Checklist
Before testing, ensure you have:
- [ ] Node.js installed (v16 or higher)
- [ ] PostgreSQL running (local or cloud)
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
# Edit .env with your `DATABASE_URL` (see examples in `backend/.env.example`)
```

### Step 3: Start Backend Server
```bash
# From backend directory
npm run dev
```

**✅ Success Signs:**
```
🚀 Server running on port 5000
📊 Health check: http://localhost:5000/api/health
🔌 WebSocket server running on ws://localhost:5000
✅ Default admin user created
✅ Default user created
✅ Database initialization completed (Postgres)
```

### Step 4: Run Automated Tests
```bash
# Open new terminal, from main directory
npm run test-backend
```

**✅ All tests should pass with green checkmarks!**

---

## 🗄️ Database Setup Options
## Database

The backend uses PostgreSQL via Sequelize. Configure Postgres and set `DATABASE_URL` in the backend `.env`.

Example local setup (psql):

```sql
CREATE DATABASE beantobin;
CREATE USER beantobin_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE beantobin TO beantobin_user;
```

Example `.env`:

```env
DATABASE_URL=postgres://beantobin_user:your_password@127.0.0.1:5432/beantobin
```

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

### Problem: "MongoDB connection error"
This project no longer uses MongoDB. If you see references to MongoDB in logs or docs, they are legacy artifacts and can be ignored or removed.

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
