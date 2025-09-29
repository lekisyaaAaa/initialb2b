caon<!-- Updated README for the Environmental Monitoring System (BeanToBin) -->
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
