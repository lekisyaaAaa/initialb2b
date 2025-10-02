Sensor Poller Service

Run: NODE_ENV=development node services/sensor-poller.js

Environment variables:
- POLL_URL (default http://localhost:5000/api/sensors/latest)
- POLL_MS (default 5000)
- JWT (optional, sent as Authorization Bearer)
- INTERNAL_PORT (default 3100) - exposes /internal/sensor-agg and /internal/health

Data persistence: writes JSONL to backend/data/sensor-stream.jsonl (append-only). A sample file is provided at backend/data/sensor-stream.sample.jsonl

Notes:
- Backoff: on failures starts at 1s doubling up to 60s
- Max concurrent polls: 3
- The service normalizes incoming payloads to a stable schema

Testing:
- Run unit tests: cd backend && npm test

Quick start examples

Run once (foreground):

```powershell
cd backend
POLL_URL=http://localhost:5000/api/sensors/latest POLL_MS=5000 node services/sensor-poller.js
```

Run with npm script:

```powershell
cd backend
npm run poller
```

Run with PM2 (background):

```powershell
cd backend
npm install -g pm2
pm2 start ecosystem.config.js
pm2 status
```

