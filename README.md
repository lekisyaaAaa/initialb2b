caon<!-- Updated README for the Environmental Monitoring System (BeanToBin) -->
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
# BeanToBin — Environmental Monitoring System

This repository contains a full-stack environmental monitoring platform (BeanToBin):

- backend/ — Node.js + Express API with Sequelize (Postgres)
- frontend/ — React + TypeScript + Tailwind dashboard
- esp32/ — Arduino/ESP32 sketches (RS485/MODBUS)
- scripts/ — utilities: seeding, simulators, smoke-tests, deployment helpers

This README is the quick operational guide: how to run locally, smoke-test, auto-start services, and deploy.

## Quick summary

- Local dev helper: `start-all.ps1` (PowerShell) starts backend + frontend and waits for health checks.
- Smoke test: `scripts/smoke-test.js` exercises admin login, actuator endpoints, and validates logs.
- Device simulator: `backend/scripts/ws-device-sim.js` simulates an ESP32 (registers over WebSocket and ACKs actuator commands).
- Auto-start: `ecosystem.config.js` + `scripts/pm2-windows-setup.ps1` to run backend and simulators via PM2 on Windows.
- Deploy: `render.yaml` and Dockerfiles are included for Render/Docker deployments.

---

## Prerequisites

- Node.js 18+ and npm
- Git
- (Local) PostgreSQL or Docker Desktop
- PowerShell on Windows (we provide PowerShell helpers)

## Quick local start (recommended for development on Windows)

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
- Frontend: http://127.0.0.1:3002 (or 3000, depending on your dev environment)

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

## Seeding admin user

There are multiple ways to ensure a dev admin exists:

- The server attempts to seed a dev admin at startup in development mode (LOCAL_ADMIN_USER/PASS defaults to `admin`/`admin`).
- Run the seed script manually:

```powershell
node backend\scripts\seed-admin.js
```

If you prefer, set `LOCAL_ADMIN_USER` and `LOCAL_ADMIN_PASS` in `backend/.env` before starting the server.

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

- `backend/Dockerfile` and `frontend/Dockerfile` exist for containerized builds.
- `docker-compose.prod.yml` provides a production-style compose file for Postgres, backend and frontend.
- `render.yaml` can be used to deploy the repo to Render (managed Postgres + services).

Recommended quick production flows:

- Render: import the repo in the Render dashboard (we included `render.yaml`). Set `DATABASE_URL` and `JWT_SECRET` in the Render environment and deploy.
- VPS with Docker Compose: use `docker-compose.prod.yml` and `.env.production` on the server. See `DEPLOY.md` for step-by-step instructions in the repo.

---

## Developer & debug tools

- `start-all.ps1` — unified local start helper (PowerShell) for backend + frontend.
- `scripts/smoke-test.js` — resilient smoke test that logs in (admin fallback), posts actuator commands and checks logs.
- `backend/scripts/ws-device-sim.js` — WebSocket device simulator that registers and ACKs commands.
- `scripts/render_deploy.ps1` — helper to import `render.yaml` using the Render CLI (keeps API key local).

---

## Troubleshooting

- Health check fails (DB unavailable): check Postgres is running and `DATABASE_URL` is correct.
- Ports in use: the backend attempts alternate ports if the configured port is busy; inspect logs for `EADDRINUSE` diagnostics.
- npm install issues (private registry): ensure `npm config get registry` is `https://registry.npmjs.org/`.
- Render CLI `@render/cli` install fails in restricted networks — use the Render web UI import instead.

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

Last saved commit: see Git HEAD in this branch. For any environment-specific help (Render import, VPS bootstrap, or Windows service via NSSM), tell me which you prefer and I will prepare the exact, tested steps.
