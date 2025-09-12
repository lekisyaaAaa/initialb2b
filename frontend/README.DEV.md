Development start instructions (stable supervised mode)

Use the supervised start so the dev server recovers from port conflicts and restarts on crashes.

Start the dev environment (PowerShell):

    cd frontend
    npm install
    npm start

Notes:
- `npm start` runs `scripts/safe-start.ps1` which kills processes on the configured PORT and then runs the supervised start script.
- The supervised start (`start-supervisor.js`) will:
  - bind the dev server to HOST=0.0.0.0 and PORT (default 3002)
  - automatically detect EADDRINUSE and attempt to kill node processes on that port
  - restart react-scripts on crash with exponential backoff
  - log to `frontend/logs/supervisor.log`

Troubleshooting:
- If the site is unreachable, check `frontend/logs/supervisor.log` and `frontend/logs/frontend_start.log`.
- If you need to force-close all node processes (careful on shared machines):

    Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force }

- If your editor triggers extremely frequent restarts, consider disabling TypeScript type checking temporarily or increasing the supervisor's restart window.
