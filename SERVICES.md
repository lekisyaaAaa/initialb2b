# Running backend and frontend

Recommended: install PM2 globally or use `npx pm2` to manage processes.

Start services with PM2:

```powershell
npx pm2 start ecosystem.config.js
npx pm2 save
```

Or use the helper script (falls back to Start-Process if PM2 unavailable):

```powershell
.\run-services.ps1
```
