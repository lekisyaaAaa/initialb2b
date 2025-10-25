# System Validation Report

**Date:** 2025-10-25  
**Environment:** Local workspace (`Windows 10`, Node.js `v22.18.0`)  
**Branches:** `fix/contact-header-gap`

---

## 1. Backend Audit (Node.js / Express / PostgreSQL)

### 1.1 Configuration & Environment Variables
- `.env` is loaded explicitly via `dotenv` in `backend/server.js` and `services/database_pg.js`.
- Database layer defaults to SQLite when `USE_SQLITE=true` (current test runs use `backend/data/dev.sqlite`).
- CORS defaults to fully open in non-production; in production it reads from `CORS_ORIGINS` & `SOCKETIO_CORS_ORIGINS`.
- No hard-coded API secrets observed; admin seeding block (commented) still references fallback credentials but does not execute.

### 1.2 Automated Tests
Command: `npm test`

| Suite | Result | Notes |
| --- | --- | --- |
| `tests/adminDevicePorts.test.js` | ✅ Pass | Smoke coverage for admin ports API |
| `__tests__/actuators.test.js` | ✅ Pass | CRUD for actuator endpoints |
| `__tests__/sensor-poller.test.js` | ✅ Pass | Poller basic behaviour |
| `__tests__/sensor-poller-backoff.test.js` | ✅ Pass | Backoff logic (logs transient network errors) |
| `__tests__/ws_device_offline.test.js` | ✅ Pass (console warning after teardown) | WS close log fired after Jest shutdown |
| `__tests__/testServerHelper.js` | ✅ Pass | Helper boot sanity |
| `__tests__/sensors_and_device.test.js` | ❌ Failing | `sequelize.sync({ alter: true })` against SQLite raises `SQLITE_ERROR: no such table: actuators` |

**Failure diagnosis:**
- `ensureDefaultActuators()` executes before schema sync completes, leaving the `actuators` table undefined.
- Suggestion: Guard the seeding call until `sequelize.sync()` resolves, or switch the test setup to `sequelize.sync({ force: true })` when `process.env.NODE_ENV === 'test'`.

### 1.3 Manual Endpoint Smoke Checklist
Use these only after DB is seeded and server running (`npm start`). All routes expect `Authorization: Bearer <token>` unless noted.

```bash
# Health
curl -i http://localhost:8000/api/health

# Auth
curl -i -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<user>","password":"<pass>"}'

# Devices
curl -i -X POST http://localhost:8000/api/devices/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"esp32-001","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'

curl -i http://localhost:8000/api/devices

# Sensor ingestion
curl -i -X POST http://localhost:8000/api/sensors \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"esp32-001","temperature":28,"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'

# Actuator command
curl -i -X POST http://localhost:8000/api/actuators/commands \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"esp32-001","actuatorId":1,"command":"toggle"}'
```

Capture responses (HTTP status + body) to populate the diagnostic log.

### 1.4 Additional Backend Observations
- Socket.IO origin guard active in production; ensure `SOCKETIO_CORS_ORIGINS` is populated during deploys.
- MQTT not detected; WebSocket fallback exists (`ws://<host>:<port>`). Device registration expects `{ type: 'register', deviceId }` payload.
- Controllers wrap async logic; errors bubble to centralized `errorHandler` with consistent `{ success:false, message }` payloads.

---

## 2. Frontend Audit (React / TypeScript)

### 2.1 Automated Tasks
| Command | Result |
| --- | --- |
| `npm run build` | ✅ Pass (previous run) |
| `npm test -- --watch=false` | ✅ Pass |

Key artefacts:
- Axios base URL normalised in `src/services/api.ts`; respects `REACT_APP_API_URL` (no hard-coded hosts).
- AuthContext now requires explicit login; no auto-admin fallback.
- Protected routes redirect to `/admin/login` when `isAuthenticated` false.

### 2.2 Manual QA Checklist
1. `npm start` → Visit `http://localhost:3002`.
2. Navigate to `/admin/login`; login using valid credentials.
3. Confirm dashboard metrics load (Network tab → calls to `/api/sensors/latest`, `/api/actuators`).
4. Navigate to Device Ports page (`/admin/devices/:id/ports`); verify enumerated + saved ports render.
5. Trigger actuator action (e.g., toggle) and confirm UI success banner.
6. Logout button clears token and redirects to `/admin/login`.
7. Test unauthenticated access: open `/admin/dashboard` in new incognito session → expect redirect.
8. Monitor browser console → ensure no React warnings or network failures.

### 2.3 UI Error Handling Review
- API service clears tokens on `401`, dispatches `auth:expired` event.
- DevicePorts page surfaces enumeration fallback message on failure.
- Global error toasts not yet centralised; consider consolidating via a notification context.

---

## 3. End-to-End Integration Workflow

Recommended flow (execute against non-production environment with seeded data):

1. **Authenticate** via `/api/auth/login`; store returned JWT.
2. **Heartbeat** an ESP32 device via `/api/devices/heartbeat` (see curl above).
3. **Post sensor payload** (`/api/sensors`). Verify response `201` and check DB table `sensor_data` (SQL: `SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 5;`).
4. **Dashboard UI** should reflect new readings (confirm via Network panel that `/api/sensors/latest` returns the inserted record).
5. **Actuator command** using UI button; confirm backend logs `devicePortsService.assignPort` / `actuatorService.enqueueCommand` and DB entry in `actuator_commands`.
6. **Logout**; ensure subsequent protected requests yield `401`.

Capture:
- HTTP status per step
- Server console logs
- Relevant DB snapshots

---

## 4. ESP32 / Device Layer

- WebSocket endpoint: `ws://<backend-host>:<port>`.
- Registration handshake expected: `{ "type": "register", "deviceId": "esp32-001" }`.
- Sensor payload shape (JSON over REST) already validated in tests; for MQTT usage, confirm broker config (not present in repo).
- Recommendation: add an integration test using a simulated WebSocket client (e.g., `ws` library) to assert command echo path.

---

## 5. Diagnostics Summary

| Component | Status | Evidence |
| --- | --- | --- |
| Backend unit/integration tests | ⚠️ Partial | `npm test` fails on `__tests__/sensors_and_device.test.js` (SQLite changeColumn). Fix seeding/sync order. |
| Frontend tests | ✅ Pass | `npm test -- --watch=false` |
| Frontend build | ✅ Pass | `npm run build` |
| Backend health | ⚠️ Untested live | Run `curl http://localhost:8000/api/health` post-fix |
| E2E flow | ⚠️ Pending | Requires coordinated backend + DB + device setup |

Log excerpts:
- See terminal output in `PowerShell` history for full error trace (timestamp: 2025-10-25 09:39 local).

---

## 6. Recommendations & Next Actions

1. **Fix backend schema sync:**
   - Option A: modify `backend/__tests__/sensors_and_device.test.js` to call `sequelize.sync({ force: true })` during tests.
   - Option B: move `ensureDefaultActuators()` invocation behind an `await sequelize.sync()` guard.
2. **Stabilise WebSocket teardown:** silence `console.log` after tests or wait for close event to prevent Jest warning.
3. **Add API smoke automation:** create Jest + Supertest suite hitting auth → sensors → actuators with real data (requires seeded DB). Wire into `npm test` once DB sync issue resolved.
4. **Implement CI pipeline:** GitHub Actions workflow running `npm ci`, backend/ frontend tests, and frontend build.
5. **Device integration test:** add scripted WebSocket client to publish mock telemetry and validate dashboard refresh (potentially via Playwright).
6. **Monitoring:** configure backend logging w/ Winston or pino, shipping to file with rotation.

---

## 7. Manual Regression Checklist (Quick Reference)
- [ ] Backend `npm test`
- [ ] Backend `curl /api/health`
- [ ] Frontend `npm run build`
- [ ] Frontend `npm test -- --watch=false`
- [ ] Login → Dashboard data load
- [ ] Device management list populated
- [ ] Actuator toggle updates backend log
- [ ] Logout clears session
- [ ] WebSocket heartbeat visible in backend logs

> **Note:** All automated flows must be re-run after resolving the SQLite sync failure to sign off the release.
