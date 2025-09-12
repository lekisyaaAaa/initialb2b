<!-- Updated README for the Environmental Monitoring System (BeanToBin) -->
# BeanToBin — Environmental Monitoring System

This repository contains a full-stack environmental monitoring platform ("BeanToBin") consisting of:

- backend/ — Node.js + Express API (Sequelize for PostgreSQL)
- frontend/ — React (TypeScript) + TailwindCSS dashboard and UI
- esp32/ — Arduino/ESP32 code for sensor collection and RS485/MODBUS integration
- scripts/ and tools for migrations, seeding and utilities

This README summarizes the system architecture, features, how to run locally, recent changes (pH support, Manila weather integration), and troubleshooting notes.

## High-level Overview

- Sensors (ESP32 + RS485) collect Temperature, Humidity, Soil Moisture and now pH (where supported).
- ESP32 devices POST sensor readings to the backend API; the backend stores and broadcasts data and raises alerts.
- The frontend provides an Admin dashboard (role-based access) and public dashboards for visualization, charts, and exports.
- A weather service (frontend-side) fetches Manila-only weather snapshots and produces realistic weather-derived sensor-like readings for correlation and analytics.

## Recent Key Changes

- pH support: `SensorData` now includes an optional `ph` field; UI charts and exports were updated to include pH.
  - New component: `frontend/src/components/charts/PhChart.tsx` — pH line chart.
  - `ChartContainer` now supports a `ph` chart type and renders `PhChart`.
  - CSV export in `AdminDashboard` includes a `ph` column.
- Weather integration changes:
  - Manila-only weather monitoring locations and a `getManilaWeatherSummary()` helper are implemented in `frontend/src/services/weatherService.ts`.
  - The Admin Dashboard `/admin/dashboard` has a `Load Weather` button which fetches and displays the Manila weather summary (Avg Temp, Avg Humidity, Avg Moisture, status, lastUpdated).
  - The Enhanced dashboard's separate weather snapshot was removed per recent UX requests; weather is now loaded via Admin only.

## Repo Layout (short)

```
./
├─ backend/                # Node/Express API, Sequelize models, routes
├─ frontend/               # React app (TypeScript), TailwindCSS, components and pages
├─ esp32/                  # ESP32/Arduino sketches for sensor polling and API integration
├─ scripts/                # Migration & helper scripts
├─ docker-compose.yml      # Optional local stack (Postgres, etc.)
└─ README.md               # This file
```

## Quick local setup

Prerequisites

- Node.js 18+ and npm
- PostgreSQL (local or Docker)
- (Optional) Twilio account for SMS alerts

1) Install root-level dev helpers (from repo root):

```powershell
# from repository root
npm ci
```

2) Backend setup

```powershell
cd backend
npm install
cp .env.example .env
# Edit backend/.env (DATABASE_URL, JWT_SECRET, TWILIO_* etc.)
npm run dev
```

- Backend server default: http://localhost:5000
- Health check endpoint: `GET /api/health`

3) Frontend setup

```powershell
cd frontend
npm install
# Set env vars locally if needed: REACT_APP_WEATHER_API_KEY, REACT_APP_WEATHERAPI_KEY
npm start
```

- Frontend dev server typically runs at http://localhost:3000 (this workspace has used http://localhost:3002 in development).

4) ESP32 device (overview)

- Configure Wi-Fi and API endpoint in `esp32/` sketch files.
- Upload the sketch to the ESP32. Devices POST sensor readings to `/api/sensors`.

## Developer notes and architecture details

- Backend
  - Express + Sequelize (supports Postgres in production; SQLite may be used for lightweight dev seeding).
  - JWT-based auth and role-based routes (admin/user).
  - Alerts subsystem triggers SMS via Twilio when thresholds are breached.

- Frontend
  - React + TypeScript + TailwindCSS.
  - `frontend/src/services/api.ts` centralizes axios configuration (uses 127.0.0.1 to avoid IPv6 preflight issues in dev).
  - `frontend/src/services/weatherService.ts` provides Manila monitoring locations, conversion to sensor-like readings, and `getManilaWeatherSummary()`.
  - `frontend/src/contexts/DataContext.tsx` orchestrates data refreshes and can populate sensor lists using weather-derived data if needed.
  - Charts are implemented via Recharts. `ChartContainer` picks chart type (temperature, humidity, moisture, ph, multi).

## How pH is integrated

- Type: `ph?: number` added to `SensorData` (see `frontend/src/types/index.ts`).
- UI: `PhChart` displays pH on a 0–14 scale; `ChartContainer` exposes a `ph` chart type.
- Export: Admin CSV export includes a `ph` column; JSON export already includes `ph` where present.

## Running tests & type checks

- Run TypeScript typecheck (frontend):

```powershell
cd frontend
npx tsc --noEmit
```

- Unit and integration tests (if present) can be executed from backend or frontend test groups — see `backend/__tests__` for backend guides; top-level `package.json` may contain combined scripts.

## Troubleshooting quick guide

- Backend port conflicts: ensure no previous Node process is binding port 5000. Use `netstat -ano | findstr ":5000"` on Windows and stop conflicting PID.
- CORS / localhost issues: development axios baseURL uses 127.0.0.1 to avoid IPv6 preflight problems.
- Weather API keys: set `REACT_APP_WEATHER_API_KEY` and/or `REACT_APP_WEATHERAPI_KEY` in `frontend/.env` to fetch live weather; otherwise the weatherService will generate realistic mock data.

## Next steps & optional improvements

- Backend-proxied weather endpoint to hide API keys from the frontend.
- Add pH thresholds and include pH-based alerts in the backend alerting engine.
- Add E2E tests for Admin Load Weather UX.

## Contact & contribution

- For contribution, fork the repo, create a branch, and open a PR to `master`.
- Include unit tests for any behavioral changes and update the README with new environment variables if added.

---

This README was updated to reflect recent work: pH support, charting, CSV export, and moving Manila weather summary display to the Admin Dashboard (click Load Weather).
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
- PostgreSQL (local or Docker)
- Twilio account for SMS (optional)
- ESP32 development board with MAX485 module

### Installation

1. **Install all dependencies:**
```bash
npm run install-all
```

2. **Setup environment variables:**
```bash
# Backend environment (copy example and edit DATABASE_URL)
cp backend/.env.example backend/.env
# Edit backend/.env and set DATABASE_URL to your Postgres connection string
```

3. **Start development servers:**
```bash
npm run dev
```

This will start:
- Backend API server on http://localhost:5000
- Frontend React app on http://localhost:3000

## 📡 Database (PostgreSQL)

This project uses PostgreSQL (via Sequelize) as the canonical runtime database. You can run Postgres locally or via Docker (see `docker-compose.yml`).

Example DATABASE_URL (placed in `backend/.env`):
```env
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/beantobin
```

Legacy migration scripts that referenced MongoDB have been preserved in `backend/legacy_migrations/` for archival or one-time migration tasks only. The running application does not require MongoDB.

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
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/beantobin

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

Husky (pre-commit smoke check)
--------------------------------
To enable the local pre-commit hook that runs a quick integration smoke check, install dev dependencies and run:

```powershell
cd c:\xampp\htdocs\beantobin\system
npm ci
npx husky install
```

This will enable the pre-commit hook defined in the root `package.json`. CI does not require husky.

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

### Database Connection Issues (PostgreSQL)
1. Ensure `DATABASE_URL` in `backend/.env` is correct and properly URL-encoded
2. If using Docker, verify the Postgres container is running: `docker ps` and view logs with `docker compose logs db`
3. Confirm database credentials and that the database exists
4. Check firewall and port bindings (host port vs container port)

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
