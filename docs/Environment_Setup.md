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
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname for Nodemailer. |
| `SMTP_PORT` | `587` | SMTP port (use 465 for SSL). |
| `EMAIL_USER` | `alerts@beantobin.com` | Auth username for SMTP server. |
| `EMAIL_PASS` | `app-password-or-token` | Auth password or app-specific token. |
| `EMAIL_FROM` | `"BeanToBin <noreply@beantobin.com>"` | Display sender for outbound mail. |
| `CORS_ORIGIN` | `https://beantobin.onrender.com` | Allowed frontend origin for API requests. |
| `ESP32_URL` | `http://192.168.0.50` | Base URL for issuing actuator commands to the ESP32 bridge. |
| `ESP32_COMMAND_TIMEOUT_MS` | `5000` | Timeout (ms) applied to actuator HTTP requests sent to the ESP32. |

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
| Health Check | `GET /api/health` |
| Environment Variables | Add every key from the table above with production values. |
| Postgres Add-on | Provision a managed Postgres instance and copy its connection string into `DATABASE_URL`. |
| WebSockets | Enable in Render (works automatically when using the Node runtime). |
| TLS | Render provides HTTPS by default—enforce HTTPS redirects on the frontend. |

After saving environment settings, redeploy the backend service. Verify deployment by hitting the `/api/health` endpoint and performing a login → OTP → dashboard flow from the production frontend.
