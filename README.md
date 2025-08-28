# Environmental Monitoring System

A comprehensive full-stack environmental monitoring system with real-time sensor data collection, dashboard visualization, and SMS alert capabilities.

## 🌟 Features

- **Real-time Monitoring**: Temperature, humidity, and moisture sensors via ESP32 + RS485
- **Web Dashboard**: Interactive charts and real-time data visualization
- **Role-based Access**: Admin (full control) and User (read-only) roles
- **SMS Alerts**: Automated notifications for critical conditions
- **Offline Capability**: Data caching when Wi-Fi is disconnected
- **Industrial Grade**: MODBUS RTU communication with MAX485

## 🏗️ Architecture

```
├── backend/          # Node.js + Express API
├── frontend/         # React + TailwindCSS Dashboard
├── esp32/           # Arduino code for ESP32 sensor integration
└── docs/            # Documentation and setup guides
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL (local or cloud) — the backend has been migrated to Postgres/Sequelize
- Twilio account for SMS (optional)
- ESP32 development board with MAX485 module

### Installation

1. **Install all dependencies:**
```bash
npm run install-all
```

2. **Setup environment variables:**
```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL, JWT secret, and Twilio keys.
```

3. **Start development servers:**
```bash
npm run dev
```

This will start:
- Backend API server on http://localhost:5000
- Frontend React app on http://localhost:3000

## �️ PostgreSQL Setup

The backend now uses PostgreSQL via Sequelize. For local development you can run Postgres locally or use a cloud provider.

1. Install PostgreSQL (Windows installers available at https://www.postgresql.org/download/).
2. Create a database and user for the application. Example (psql):

   CREATE DATABASE beantobin;
   CREATE USER beantobin_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE beantobin TO beantobin_user;

3. Set the connection URL in the backend `.env` using the `DATABASE_URL` variable. Example:

```env
DATABASE_URL=postgres://beantobin_user:your_password@127.0.0.1:5432/beantobin
```

If your Postgres instance listens on a non-standard port (for example 5075 in this workspace), adjust the URL accordingly (127.0.0.1:5075).

Notes:
- For cloud Postgres providers, paste the provided connection string into `DATABASE_URL`.
- If your provider requires SSL, set NODE_TLS_REJECT_UNAUTHORIZED=0 only for local testing and configure Sequelize `dialectOptions` for production.

## 🔧 Backend Setup Guide

### Step 1: Navigate to Backend
```bash
cd backend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
```

Edit `.env` file with your settings:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5075/beantobin

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Alert Settings
DEFAULT_TEMP_THRESHOLD=30
DEFAULT_HUMIDITY_THRESHOLD=80
DEFAULT_MOISTURE_THRESHOLD=20
```

### Step 4: Start Backend Server
```bash
npm run dev
```

The backend will be available at http://localhost:5000

### Step 5: Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/health

# Get sensor data
curl http://localhost:5000/api/sensors/latest
```

## 🎨 Frontend Setup

The React frontend will automatically start when you run `npm run dev` from the root directory.

### Manual Frontend Setup:
```bash
cd frontend
npm install
npm start
```

## 📱 ESP32 Setup

1. **Hardware Requirements:**
   - ESP32 development board
   - MAX485 TTL to RS485 converter
   - Environmental sensors with RS485/MODBUS interface

2. **Arduino IDE Setup:**
   - Install ESP32 board package
   - Install required libraries (see esp32/README.md)

3. **Upload Code:**
   - Open `esp32/environmental_monitor.ino`
   - Configure Wi-Fi credentials and server endpoint
   - Upload to ESP32

## 🔐 Default Login Credentials

- **Admin**: username: `admin`, password: `admin`
- **User**: username: `user`, password: `user`

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Sensors
- `GET /api/sensors/latest` - Get current sensor readings
- `GET /api/sensors/history` - Get historical data
- `POST /api/sensors` - Submit sensor data (ESP32)

### Alerts
- `GET /api/alerts` - Get recent alerts
- `POST /api/alerts/test` - Test SMS alert

### Settings (Admin only)
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update alert thresholds

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy to Vercel
```

### Backend (Railway/Render)
```bash
# Push to GitHub and connect to Railway/Render
# Environment variables will be configured in the platform
```

## 🔧 Troubleshooting

### MongoDB Connection Issues
1. Check network connectivity
2. Verify connection string format
3. Ensure IP whitelist includes your address
4. Confirm database user credentials

### ESP32 Not Sending Data
1. Check Wi-Fi connection
2. Verify server endpoint URL
3. Monitor Serial output for errors
4. Test RS485 wiring connections

### SMS Alerts Not Working
1. Verify Twilio credentials
2. Check phone number format (+1234567890)
3. Ensure sufficient Twilio balance

## 📝 License

MIT License - see LICENSE file for details.
