# Developer quickstart (DEV)

This file documents the quick steps to start the project locally and run a minimal smoke check.

Recommended: use the included PowerShell helper which frees ports, starts backend and frontend, runs the seeder, and verifies health/login.

Quick one-liner (from repo root):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-all.ps1 -NoInstall -Verbose
```

What the helper does:
- Attempts to stop processes listening on ports 5000 and 3002.
- Starts `backend` and `frontend` in new PowerShell windows and writes logs to `backend/logs` and `frontend/logs`.
- Runs `backend/scripts/seed-admin.js` to ensure a dev admin user exists (default `admin`/`admin`).
- Probes `/api/health`, `/health` and runs a login test against `/api/auth/login`.

Manual steps (if you prefer):

1. Free ports (optional):

```powershell
Set-Location .\scripts
.\port-fix.ps1 -Port 5000 -Kill
.\port-fix.ps1 -Port 3002 -Kill
```

2. Start backend (from repo root):

```powershell
Set-Location .\backend
if (-not (Test-Path .\logs)) { New-Item -ItemType Directory -Path .\logs | Out-Null }
Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory (Get-Location) -RedirectStandardOutput ..\backend\logs\stdout.log -RedirectStandardError ..\backend\logs\stderr.log -WindowStyle Hidden

# optional: run seeder manually
node .\scripts\seed-admin.js
```

3. Start frontend (from repo root):

```powershell
Set-Location .\frontend
if (-not (Test-Path .\logs)) { New-Item -ItemType Directory -Path .\logs | Out-Null }
Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory (Get-Location) -RedirectStandardOutput ..\frontend\logs\stdout.log -RedirectStandardError ..\frontend\logs\stderr.log -WindowStyle Hidden
```

4. Verify endpoints:

```powershell
Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -UseBasicParsing
Invoke-WebRequest -Uri 'http://localhost:3002/health' -UseBasicParsing
Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method POST -Body (@{username='admin'; password='admin'} | ConvertTo-Json) -ContentType 'application/json'
```

ENV notes:
- `backend/.env` contains `DATABASE_URL` pointing to Postgres and `ENABLE_LOCAL_ADMIN=false` by default. For local dev when Postgres is unavailable you may set `ENABLE_LOCAL_ADMIN=true` (dev only).
- `JWT_SECRET` is present in `.env` for local dev; rotate for production.

Logs:
- Backend logs: `backend/logs/stdout.log` and `backend/logs/stderr.log`
- Frontend logs: `frontend/logs/stdout.log` and `frontend/logs/stderr.log`

If you want, add Postgres locally (Docker recommended) and update `backend/.env` `DATABASE_URL` to point to it.

Production notes:
- Do NOT commit production secrets (JWT_SECRET, DATABASE_URL) into the repository. Use CI/CD secrets or environment variables instead.
- Before deploying to production ensure `ENABLE_LOCAL_ADMIN=false` in your production environment and that `JWT_SECRET` is set to a strong secret.
- The repo contains `backend/.env` for local convenience; make sure your deployment pipeline uses environment variables or a secrets manager.

Local git hooks (recommended)
--------------------------------
This repository includes a small pre-commit hook that prevents committing `.env` files.
To enable it locally (repo-only), run:

```powershell
git config core.hooksPath .githooks
```

The hook will block commits that add `.env`, `backend/.env`, `frontend/.env` or any file matching `*.env`.
If you prefer not to use hooks, ensure you never commit secrets and rely on CI checks instead.

---
Small note: this repo already includes `scripts/start-all.ps1` and `scripts/port-fix.ps1` for Windows dev convenience.
