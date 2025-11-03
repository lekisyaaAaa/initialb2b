# Deployment guide

The project supports multiple hosting targets. This page highlights the Render free-tier blueprint (VermiLinks production stack) and notes alternative options.

## Render blueprint (recommended)

We ship a ready-to-import blueprint at `render.yaml` that provisions:

- `vermilinks-backend` — Node service (free plan) under `backend/`
- `vermilinks-frontend` — Static site (free plan) under `frontend/`
- `vermilinks-db` — Managed PostgreSQL (free plan)

### Deploy steps

1. Push the branch that Render should watch (default: `main`).
2. In Render: `Blueprints → New Blueprint Instance` and select this repository.
3. Confirm the resources match the blueprint (service names above, `staticPublishPath: build`).
4. Populate backend environment variables (see `backend/.env.example` for values):
   - `JWT_SECRET`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `EMAIL_FROM`
   - `CORS_ORIGINS`
   - `SOCKETIO_CORS_ORIGINS`
   - `ESP32_URL`
   - `ESP32_COMMAND_TIMEOUT_MS`
   - `INIT_ADMIN_EMAIL`
   - `INIT_ADMIN_PASSWORD`
5. Populate frontend variables on the static site:
   - `REACT_APP_API_URL`
   - `REACT_APP_WS_URL`
6. Render automatically injects `DATABASE_URL` from `vermilinks-db`; no manual secret required.
7. After the first deploy, open a shell on `vermilinks-backend` and run:

   ```bash
   npm run migrate
   npm run seed-admin
   ```

8. Health-check `https://api.vermilinks.com/api/health` and sign in at the frontend (`/admin/login`).

All services stay on the free tier and will auto-sleep when idle.

## Alternatives

### Docker host / VPS

- Use `docker-compose.yml` (local/dev) or build images and run them on a server.
- Ensure `DATABASE_URL`, `JWT_SECRET`, SMTP credentials, and admin seed values are configured.
- Expose ports 5000 (backend API) and 3000/3002 (frontend depending on your build).

### Railway / Fly.io

- Mirror the Render setup: Node backend, static frontend, managed Postgres.
- Set the same environment variables listed above.

### GitHub Actions + Docker Hub (CI)

- The included workflow builds and pushes images on `main`.
- Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets to the repository.

## Production notes

- Terminate TLS (Render manages this automatically).
- Keep `JWT_SECRET`, SMTP password, and admin credentials secret.
- Enable alerting (Twilio) by setting the optional `TWILIO_*` environment variables.
