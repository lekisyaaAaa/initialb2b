# Environment Setup

BeanToBin requires a fully configured environment before starting the backend service. This guide lists all required variables and provides guidance for local development and Render deployment.

## Required Variables

| Key | Example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:password@127.0.0.1:5432/beantobin` | PostgreSQL connection string used by Sequelize. |
| `JWT_SECRET` | `super_long_random_value` | Secret for signing admin and user JWTs. |
| `RESET_TOKEN_EXPIRY_MINUTES` | `15` | Minutes before password reset tokens expire. |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limiting window (ms) for admin auth endpoints. |
| `RATE_LIMIT_MAX` | `5` | Maximum requests per IP per window for admin auth endpoints. |
| `LOG_LEVEL` | `info` | Controls backend logger verbosity (`fatal` → `trace`). |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname for Nodemailer. |
| `SMTP_PORT` | `587` | SMTP port (use 465 for SSL). |
| `EMAIL_USER` | `alerts@beantobin.com` | Auth username for SMTP server. |
| `EMAIL_PASS` | `app-password-or-token` | Auth password or app-specific token. |
| `EMAIL_FROM` | `"BeanToBin <noreply@beantobin.com>"` | Display sender for outbound mail. |
| `CORS_ORIGINS` | `https://beantobin.onrender.com,https://dashboard.beantobin.com` | Comma-separated list of allowed frontend origins for API requests. |
| `SOCKETIO_CORS_ORIGINS` | *(optional)* | Override allowed origins for Socket.IO (defaults to `CORS_ORIGINS`). |
| `ALLOW_HOME_ASSISTANT_PUSH_WITHOUT_SOCKET` | `true` | Accept REST snapshots from Home Assistant even when no device socket is connected. |
| `REACT_APP_SENSOR_POLL_INTERVAL_MS` | `5000` | Frontend polling cadence (ms) for `/api/sensors/latest`. |
| `REACT_APP_DUMMY_MODE` | `true` | Enables dummy-data messaging and hides actuator controls in the dashboard. |
| `REACT_APP_HOME_ASSISTANT_URL` | `https://homeassistant.local:8123` | Target URL for the “Open Home Assistant” button. |
| `REACT_APP_ENABLE_SOCKETS` | `false` | Leave disabled unless real hardware sockets are restored. |

> Legacy actuator settings such as `ESP32_URL` and `ESP32_COMMAND_TIMEOUT_MS` are no longer used; keep them unset in dummy mode deployments.

## Home Assistant Bridge (Optional)

| Key | Example | Purpose |
| --- | --- | --- |
| `ENABLE_HOME_ASSISTANT_BRIDGE` | `false` | Toggle the in-process bridge that streams Home Assistant telemetry into VermiLinks. |
| `HOME_ASSISTANT_BASE_URL` | `http://192.168.8.134:8123` | Base URL used for REST hydration and deriving the WebSocket endpoint. |
| `HOME_ASSISTANT_WS_URL` | `ws://192.168.8.134:8123/api/websocket` | Override the derived WebSocket URL when Home Assistant is exposed via a tunnel or reverse proxy. |
| `HOME_ASSISTANT_TOKEN` | `<long-lived-access-token>` | Home Assistant long-lived access token used for WebSocket auth and REST hydration. |
| `HOME_ASSISTANT_SENSOR_MAP` | `{"temperature":"sensor.vermilinks_temperature"}` | JSON or comma-separated mapping of VermiLinks sensor fields to Home Assistant `entity_id`s. Supports attribute lookups. |
| `HOME_ASSISTANT_DEVICE_ID` | `vermilinks-homeassistant` | Device identifier attached to Home Assistant readings in the VermiLinks tables. |
| `HOME_ASSISTANT_FLUSH_DEBOUNCE_MS` | `250` | (Optional) Debounce interval before persisting combined readings, allowing multiple entity updates to coalesce. |
| `HOME_ASSISTANT_ALLOW_INSECURE_TLS` | `false` | Set to `true` only when using self-signed certificates and you explicitly trust the Home Assistant endpoint. |
| `ALLOW_HOME_ASSISTANT_PUSH_WITHOUT_SOCKET` | `true` | Permit Home Assistant to push snapshots over REST even if the device is not connected via WebSocket. |

## Local Development

1. Copy `backend/.env.example` to `backend/.env` and fill in the required values.
2. Start a local PostgreSQL instance and update `DATABASE_URL` accordingly.
3. Provide working SMTP credentials (or use a local SMTP mock for development).
4. Run `npm install` in `backend/`, then `npm run dev` to start the server.

## Render Deployment Checklist

| Step | Render Setting |
| --- | --- |
| Environment | Set `NODE_ENV=production`. |
| Build Command | `cd backend && npm ci` |
| Start Command | `cd backend && npm run start` |
| Health Check | `GET /health` (also `GET /api/health`) |
| Environment Variables | Add every key from the table above with production values. |
| Postgres Add-on | Provision a managed Postgres instance and copy its connection string into `DATABASE_URL`. |
| WebSockets | Enable in Render (works automatically when using the Node runtime). |
| TLS | Render provides HTTPS by default—enforce HTTPS redirects on the frontend. |

After saving environment settings, redeploy the backend service. Verify deployment by hitting the `/api/health` endpoint and performing a login → OTP → dashboard flow from the production frontend.
