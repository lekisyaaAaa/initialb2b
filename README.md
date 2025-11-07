c# BeanToBin Environmental Monitoring System

## 🚀 Quick Start

### Recommended: Use the Startup Script (Handles Everything Automatically)

```powershell
# Windows PowerShell - This script installs dependencies, builds frontend, starts services, and verifies health
powershell -ExecutionPolicy Bypass -File .\start-all.ps1
```

This script will:
- Install backend and frontend dependencies if missing
- Build the frontend production bundle
- Start all services with PM2 (backend on port 5000, frontend on port 3002)
- Wait for services to be healthy
- Display status and access URLs

### Alternative: Manual PM2 Setup

```bash
# Install PM2 globally (one-time setup)
npm install -g pm2


# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs
```

### "Unable to connect to server" Error
If you get connection errors when trying to sign in:

1. **Check if backend is running:**
   ```bash
   pm2 list
   # or
   curl http://localhost:5000/api/health
   ```

2. **Restart services:**
   ```bash
   pm2 restart all
   ```

3. **Check logs:**
   ```bash
   pm2 logs beantobin-backend
   ```

4. **Manual start (if PM2 not available):**
   ```bash
   cd backend
   node server.js
   ```

### Services Should Always Run On:
- **Frontend:** http://localhost:3002
- **Backend:** http://localhost:5000

## 🛡️ Preventive Measures

### 1. Use PM2 for Production-Ready Service Management
- PM2 automatically restarts crashed services
- Provides process monitoring and logging
- Better than direct `node` commands for development

### 2. Environment Variables
Ensure these are set in `backend/.env`:
```
PORT=5000
NODE_ENV=development
DATABASE_URL=postgres://...
```

### 3. Database Connection
The system uses PostgreSQL with SQLite fallback for development.

### 4. Admin Credentials
Admin authentication is being upgraded. Configure administrator accounts using the forthcoming email-based flow (Phase 2). Until then, seed credentials explicitly via environment variables when running local scripts.

## 📊 Monitoring

- **Health Check:** http://localhost:5000/api/health
- **PM2 Dashboard:** `pm2 monit`
- **Logs:** `pm2 logs`

## 🔄 Development Workflow

1. Start services: `pm2 start ecosystem.config.js`
2. Check status: `pm2 list`
3. View frontend: http://localhost:3002/dashboard
4. Stop when done: `pm2 stop all`on<!-- Updated README for the Environmental Monitoring System (BeanToBin) -->
# BeanToBin — Environmental Monitoring System
# BeanToBin — Environmental Monitoring System

What is BeanToBin?

BeanToBin is a capstone IoT project for compost monitoring. It collects environmental sensor data from ESP32-based devices attached to RS485/MODBUS sensors, provides a web dashboard for visualization and control, and supports actuator control and notifications to maintain optimal composting conditions.

Why it exists

- Built as a capstone academic project to demonstrate end-to-end IoT data collection, real-time control, and cloud-ready deployment for small-scale environmental monitoring (composting).

One-sentence system summary

- ESP32 devices → Backend API (Node/Express + Sequelize/Postgres) → Frontend dashboard (React/TypeScript + Tailwind); actuators are controlled via WebSocket-connected devices and actions are persisted and auditable.

## Features

- Real-time sensor monitoring (temperature, humidity, soil moisture, pH, EC, NPK)
- Actuator control (pump, solenoid valve)
- Alerts & notifications (SMS via Twilio integration)
- Weather integration (Manila-specific weather sampling and synthetic sensor correlation)
- Exportable reports (CSV, PDF)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + TailwindCSS |
| Backend | Node.js + Express + Sequelize |
| Database | PostgreSQL |
| IoT | ESP32 with RS485 / MODBUS sensors |
| Deployment | Docker, Render, Vercel / Netlify (frontend) |

## Screenshots

*(placeholders — replace with real screenshots in `frontend_design_bundle/` or `screenshots/`)*

- Dashboard overview

![Dashboard overview](screenshots/dashboard-overview.png)

- Actuator Controls (Admin)

![Actuator controls](screenshots/actuator-controls.png)

- Sensor timeline chart

![Sensor chart](screenshots/sensor-chart.png)

---

## Repository contents (short)

- `backend/` — Node/Express API, Sequelize models, routes
- `frontend/` — React app (TypeScript), TailwindCSS, components and pages
- `esp32/` — ESP32/Arduino sketches for sensor polling and API integration
- `scripts/` — Migration & helper scripts (seeding, smoke-tests, simulators)
- `docker-compose.yml` — Optional local stack (Postgres, etc.)
- `README.md` — This file

---

## High-level Overview

- Sensors (ESP32 + RS485) collect Temperature, Humidity, Soil Moisture and pH (where supported).
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

---

## Quick local setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL (local or Docker)
- (Optional) Twilio account for SMS alerts

### Recommended quick start (Windows)

1) From repository root install dependencies once:

```powershell
cd C:\xampp\htdocs\beantobin\system
npm run install-all
```

2) Start backend + frontend using the helper (waits for health checks):

```powershell
PowerShell -ExecutionPolicy Bypass -File .\start-all.ps1
```

- Backend health: http://127.0.0.1:5000/api/health
- Frontend: http://127.0.0.1:3000 (default; some dev setups use 3002)

3) Run the resilient smoke test (verifies actuator endpoints and DB logging):

```powershell
node .\scripts\smoke-test.js
```

Expected: the script logs in (uses dev admin), posts pump/valve commands, and verifies actuator logs. It will exit with code 0 on success.

4) Run a simulated device to test forwarding & ack behavior:

```powershell
# starts a simulator that registers as esp32-test-01
node backend\scripts\ws-device-sim.js ws://127.0.0.1:5000 esp32-test-01

# or register as the smoke device used by the smoke test
node backend\scripts\ws-device-sim.js ws://127.0.0.1:5000 smoke-sim-01
```

When a simulator is connected the actuator endpoints will return `forwarded: true` and the simulator will send `actuator:ack` messages.

---

## IoT integration guide

### Required Arduino libraries

- `WiFi.h` (bundled with the ESP32 core)
- `WiFiClientSecure.h` and `HTTPClient.h`
- `ArduinoJson` (install through the Arduino Library Manager)
- *(Optional)* `SocketIoClient.h` — only needed if you switch the firmware back to a socket-first transport

### Firmware upload checklist

1. Open `esp32/environmental_monitor.ino` in the Arduino IDE.
2. Install the ESP32 board definitions (Tools → Board → Boards Manager → *esp32* by Espressif).
3. Select **ESP32 Dev Module**, set Flash size to 4 MB, and choose the COM port detected when the board is connected.
4. Review `esp32/config.h` and confirm the production credentials:
   - SSID `Knights_IOT`
   - Password `smbcr-5540`
   - Telemetry endpoint `https://vermilinks-backend.onrender.com/api/sensors`
5. Click **Verify** then **Upload**. Keep the board powered during flashing.

### Wiring reference

- **Power**: 5 V adapter into the ESP32 *VIN* pin and GND shared with all peripherals.
- **RS485/MAX485** (soil probe): RO → GPIO16, DI → GPIO17, RE/DE → GPIO18.
- **Solenoid relays**: IN1 → GPIO25, IN2 → GPIO26, IN3 → GPIO27 (active-low expected).
- **Float sensor**: connect to GPIO5 (board silk “D5/DB5”) with the other lead tied to GND; use the ESP32 internal pull-up.
- **Optional battery monitor / analog sensors**: wire as needed and update the firmware stubs.

### Field test plan

1. Open the Arduino Serial Monitor at 115200 baud and power the ESP32. Confirm Wi-Fi connection logs and HTTP 200 responses.
2. In the Render dashboard open the backend logs – each telemetry POST should create a row in the `sensordata` table (check via `npm run migrate && npm run db:console` locally if needed).
3. From the dashboard Solenoid Valve cards press **Turn ON/OFF** for each valve. A matching row should appear in `/api/command/status`, and Socket.IO updates should flip the badge in real time once the ESP32 acknowledges.
4. Trip the float sensor (LOW). All valves should immediately show OFF and new commands must fail with a float-sensor warning (check the command message).

### Deployment & troubleshooting notes

- Render’s Basic Postgres tier requires allow-listing outbound IPs. Fetch them with:

  ```powershell
  Invoke-RestMethod -Headers @{ Authorization = "Bearer $env:RENDER_API_KEY" } \
    -Uri "https://api.render.com/v1/services/srv-d43v9q0dl3ps73aarv30/outboundIPs"
  ```

  Add each `outboundIPs[]` value with `/32` under **Render → vermilinks-db → Networking → Allowed inbound IPs**.
- Keep `DATABASE_URL` appended with `?sslmode=require`. The backend automatically applies `dialectOptions.ssl = { require: true, rejectUnauthorized: false }`.
- If Sequelize migrations fail on Render, run `npm run migrate` from the service shell after the allow list is updated.
- Socket.IO failures usually mean the browser is connecting to the wrong host. Confirm `REACT_APP_WS_URL` equals `wss://vermilinks-backend.onrender.com` (or the custom domain).
- Float sensor wiring now depends on GPIO5 — if valves remain disabled, verify the reed switch is pulled HIGH when water is present.

---

## Seeding admin user

To provision an admin account in development, supply credentials via environment variables and run the seed script manually:

```powershell
INIT_ADMIN_EMAIL=admin@example.com INIT_ADMIN_PASSWORD=ChangeMe node backend\scripts\seed-admin.js
```

> The seeder requires `INIT_ADMIN_EMAIL` and `INIT_ADMIN_PASSWORD` (or corresponding values in `backend/.env`). The old LOCAL_ADMIN_USER/PASS fallback has been removed.

---

## Auto-start on Windows (PM2)

We provide a PM2 ecosystem and a helper to register PM2 on Windows:

- `ecosystem.config.js` — defines processes: backend and two simulators (smoke and esp32-test-01)
- `scripts/pm2-windows-setup.ps1` — installs `pm2`, attempts to install `pm2-windows-startup`, starts the ecosystem, and saves the process list.

Usage (run as Administrator for the startup registration step):

```powershell
cd C:\xampp\htdocs\beantobin\system
.\scripts\pm2-windows-setup.ps1

# Check pm2 status
pm2 list
pm2 logs btb-backend
```

Notes:
- If `pm2-startup` registration fails, run `pm2-startup install` manually as Administrator.
- Alternative: use NSSM to register Node scripts as native Windows services — tell me if you prefer that and I will add NSSM helpers.

---

## Docker / Production


### Render Deployment (Free Tier, VermiLinks.com)

The repository includes a Render blueprint tuned for the ESP32-only VermiLinks stack. It provisions three free-tier services: `vermilinks-backend` (Node), `vermilinks-frontend` (static site), and `vermilinks-db` (managed PostgreSQL).

1. Commit and push your changes to the branch Render will track (recommended: `main`).
2. In Render, choose **Blueprints → New Blueprint Instance** and select this repository.
3. Confirm the generated resources match `render.yaml`:
  - `vermilinks-backend` (plan `free`, rootDir `backend`, health path `/api/health`).
  - `vermilinks-frontend` (plan `free`, rootDir `frontend`, publish path `build`).
  - `vermilinks-db` (plan `free`).
4. Populate backend environment variables under **vermilinks-backend → Environment** (values mirror `backend/.env.example`):
  - `JWT_SECRET=vermilinks_secret_2025`
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=587`
  - `EMAIL_USER=beantobin2025@gmail.com`
  - `EMAIL_PASS=<Gmail app password>`
  - `EMAIL_FROM="BeanToBin <beantobin2025@gmail.com>"`
  - `CORS_ORIGINS=https://vermilinks.com,https://www.vermilinks.com`
  - `SOCKETIO_CORS_ORIGINS=https://vermilinks.com,https://www.vermilinks.com`
  - `ESP32_URL=https://api.vermilinks.com/api/esp32`
  - `ESP32_COMMAND_TIMEOUT_MS=5000`
  - `INIT_ADMIN_EMAIL=beantobin2025@gmail.com`
  - `INIT_ADMIN_PASSWORD=Bean2bin2025`
5. Populate frontend variables under **vermilinks-frontend → Environment**:
  - `REACT_APP_API_URL=https://api.vermilinks.com/api`
  - `REACT_APP_WS_URL=wss://api.vermilinks.com`
6. Deploy the blueprint. Once the backend is live, open a shell for `vermilinks-backend` and run:

  ```bash
  npm run migrate
  npm run seed-admin
  ```

7. Verify `https://api.vermilinks.com/api/health` returns `{ "status": "ok" }`, then log in at `https://vermilinks.com/admin/login` using `beantobin2025@gmail.com / Bean2bin2025`.

- Render automatically wires `DATABASE_URL` from `vermilinks-db`; no manual secret is needed for the connection string.
- All resources stay on the free plan so the deployment runs at $0/month (services auto-sleep when idle).

Recommended quick production flows:

- Render: import the repo in the Render dashboard (we included `render.yaml`). Set `DATABASE_URL` and `JWT_SECRET` in the Render environment and deploy.
- VPS with Docker Compose: use `docker-compose.prod.yml` and `.env.production` on the server. See `DEPLOY.md` for step-by-step instructions in the repo.

---

## Developer & debug tools

- `start-all.ps1` — unified local start helper (PowerShell) for backend + frontend.
- `scripts/smoke-test.js` — resilient smoke test that logs in (admin fallback), posts actuator commands and checks logs.
- `backend/scripts/ws-device-sim.js` — WebSocket device simulator that registers and ACKs commands.
- `scripts/render_deploy.ps1` — helper to import `render.yaml` using the Render CLI (keeps API key local).

---rnu

## Troubleshooting

- Health check fails (DB unavailable): check Postgres is running and `DATABASE_URL` is correct.
- Ports in use: the backend attempts alternate ports if the configured port is busy; inspect logs for `EADDRINUSE` diagnostics.
- npm install issues (private registry): ensure `npm config get registry` is `https://registry.npmjs.org/`.
- Render CLI `@render/cli` install fails in restricted networks — use the Render web UI import instead.

---

## Onboarding Tour (guided walkthrough)

This project includes a lightweight guided onboarding tour to help first-time users discover key features.

Where it lives

- Frontend component: `frontend/src/components/OnboardingTour` — a small wrapper around `intro.js`.
- Tour steps config: `frontend/src/components/OnboardingTour/tourConfig.ts` — a simple array of steps.

How it works

- The tour automatically runs only for first-time visitors. A flag is stored in `localStorage` under the key `onboarding_seen` after completion or skip.
- The tour is integrated at the top-level `App` component so it can highlight elements across routes.

Configuring & extending steps

1. Open `frontend/src/components/OnboardingTour/tourConfig.ts`.
2. Add or remove step objects. Each step has the shape: `{ element?: string, title?: string, intro: string }`.
  - `element` is a CSS selector (e.g. `'#admin-access-btn'` or `'nav'`). If omitted, a center modal step is shown.
  - `title` is optional and shown above the content.
  - `intro` is the short description shown in the tooltip.

Example step:

```ts
{ element: '#actuator-controls', title: 'Actuator Controls', intro: 'Open the actuator panel to manually operate devices.' }
```

Controlling when the tour runs

- The tour reads/writes `localStorage.onboarding_seen`. To force the tour to show again during development, run in the browser console:

```js
localStorage.removeItem('onboarding_seen');
window.location.reload();
```

Custom storage key

- The `OnboardingTour` component accepts a `storageKey` prop if you need a different key (e.g., per-user keys).

Library choice

- We use `intro.js` (framework-agnostic) to remain compatible with the project's React version. This keeps the integration minimal and easy to maintain.


---

## Useful commands (copy/paste)

- Start services (PowerShell helper):
  - `PowerShell -ExecutionPolicy Bypass -File .\start-all.ps1`
- Run smoke test locally:
  - `node scripts/smoke-test.js`
- Start a device simulator (registers on WS):
  - `node backend\scripts\ws-device-sim.js ws://127.0.0.1:5000 smoke-sim-01`
- Install and run PM2 ecosystem (Administrator):
  - `.\scripts\pm2-windows-setup.ps1`

---

If you want, I can also add a short `README-DEPLOY.md` tailored to a chosen hosting provider (Render, Railway, or a one-liner VPS script with Let's Encrypt). Tell me which target you prefer and I'll add it.

---

## Screenshots & assets

Add actual screenshots to `screenshots/` or `frontend_design_bundle/` and update the image paths above. Optimized PNGs (under 500 KB) are recommended for repo storage.

---

## Contributing

Thanks for your interest in contributing! A few quick guidelines:

1. Fork the repository and create a feature branch from `main` (or from your working branch): `git checkout -b feature/your-change`
2. Add tests for changes where appropriate. Keep changes focused and documented.
3. Make small, well-scoped commits and push your branch to your fork.
4. Open a Pull Request describing the change and link related issues. CI will run on the PR.

If you want to contribute infrastructure changes (Docker/Render), include clear deploy notes and a rollback plan in the PR description.

---

## License

This project is licensed under the MIT License — see the `LICENSE` file for details.

---

Last saved commit: see Git HEAD in this branch. For any environment-specific help (Render import, VPS bootstrap, or Windows service via NSSM), tell me which you prefer and I will prepare the exact, tested steps.
