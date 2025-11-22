# Home Assistant → VermiLinks Webhook Pipeline

This document captures the contract, persistence model, and realtime fan-out path for Home Assistant (HA) telemetry that replaces the legacy `/dashboard` polling view. Everything here is compatible with Render's free tier (single Node.js web service, no background workers).

## 1. Goals

- Accept push telemetry from HA automations/webhooks with a deterministic schema.
- Persist both the *latest snapshot* and a rolling 7-day history in Postgres.
- Emit realtime socket events so the admin dashboard updates instantly.
- Keep OTP/login flows untouched and ensure Render free-plan resource limits are observed.

## 2. HTTP Contract

**Endpoint:** `POST /api/ha/webhook`

**Headers:**

| Header | Purpose |
| --- | --- |
| `Content-Type: application/json` | JSON payload |
| `X-HA-SIGNATURE` | HMAC-SHA256 of the raw request body using `HOME_ASSISTANT_WEBHOOK_SECRET`. If absent we fallback to `Authorization: Bearer <secret>` for easier testing. |
| `X-HA-DEVICE` (optional) | Overrides `deviceId` in body when automations cannot edit JSON. |

**Body shape:**

```jsonc
{
  "deviceId": "esp32b-rs485",
  "timestamp": "2025-11-15T14:05:12.321Z",
  "temperature": 24.6,
  "humidity": 58.2,
  "moisture": 41.5,
  "ph": 6.8,
  "ec": 1.23,
  "nitrogen": 40,
  "phosphorus": 10,
  "potassium": 55,
  "signalStrength": -63,
  "waterLevel": 1,
  "floatSensor": 0,
  "actuators": {
    "water_pump": false,
    "solenoid_1": true
  },
  "source": "esp32"
}
```

- Either send metrics at the top level (preferred) or nest the old `{ "metrics": { ... } }` object—both paths are supported.
- `timestamp` defaults to server time when omitted.
- At least one numeric metric is required.
- Extra keys are ignored but captured inside `rawPayload` for audit.

**Response:** `201` + normalized snapshot `{ success: true, data: { ... } }` or `202` when dropped as duplicate (same signature within 1s tolerance).

## 3. Authentication & Validation

1. Compute `expected = HMAC_SHA256(rawBody, HOME_ASSISTANT_WEBHOOK_SECRET)` and compare (timing safe) against `X-HA-SIGNATURE`. If header missing we allow `Authorization: Bearer SECRET` (still checked in constant-time).
2. Apply a dedicated rate limiter: 30 req/min per IP.
3. Reject payloads lacking metrics, invalid numbers, or timestamps older than 2 minutes.
4. Deduplicate: signature of `{deviceId,timestamp,metrics}` cached for 60s to avoid loops.

## 4. Persistence Model

### Tables/Columns

- `sensordata`
  - Add `source` (`STRING`, nullable) → e.g., `home_assistant` | `esp32`.
  - Add `rawPayload` (`JSONB`) for original HA payload (capped to 8 KB server-side).
  - Retain existing numeric columns.
- `sensor_snapshots` (already stores the latest per device) – continues to be refreshed on each webhook.

### Lifecycle

1. Insert a new `sensordata` row for every webhook (no longer deleting prior readings).
2. Keep rolling 7-day history via nightly cron or per-request cleanup: `DELETE FROM sensordata WHERE deviceId = $1 AND timestamp < NOW() - INTERVAL '7 days'` (implemented inline post-insert to stay Render-friendly).
3. Update / upsert `sensor_snapshots` so `/api/sensors/latest` remains fast.

## 5. Realtime Fan-out

- After persistence we reuse `sensorEvents.checkThresholds` and `sensorEvents.broadcastSensorData`.
- Socket topics affected:
  - `telemetry:update` – canonical payload for DataContext consumers.
  - `sensor_update` – legacy alias.
  - `device_sensor_update` – summary for mini-widgets.
- Native WS clients (ESP32) also receive summaries when connected, since `broadcastSensorData` already loops over `global.wsConnections`.

## 6. Frontend Consumption

- `DataContext` already listens for `telemetry:update`. We will surface:
  - Live snapshot panel in `AdminDashboard` fed directly from context.
  - 7-day mini history chart via new `sensorService.getSensorData({ deviceId, since })` call using `/api/ha/history` helper (proxy to `/api/sensors?deviceId=...&since=...`).
- `/dashboard` route and nav links are removed; admin view is the single source of telemetry truth.

## 7. Render Free-Plan Constraints

- Single web service only; no worker dynos. All background work happens inline and is kept lightweight.
- No additional TCP listeners beyond existing HTTP/WS.
- Use `HOME_ASSISTANT_WEBHOOK_SECRET`, `HOME_ASSISTANT_DEVICE_ID`, and `REACT_APP_ENABLE_SOCKETS=true` (front-end) for realtime updates.
- Keep bundle size modest: new UI widgets reuse existing components and lazy-load large chart libs.

## 8. Implementation Checklist

- [ ] Add migration for `sensordata.source` + `sensordata.raw_payload`.
- [ ] Create `backend/routes/homeAssistant.js` exposing `POST /api/ha/webhook`, `GET /api/ha/history` (7-day data, admins only).
- [ ] Wire route behind `app.use('/api/ha', homeAssistantRoutes)` and env validation.
- [ ] Extend `SensorData` model + sanitizers to include `source` & `rawPayload`.
- [ ] Update frontend DataContext/Admin dashboard to render live HA telemetry and history; remove `/dashboard` route + links.
- [ ] Document setup in `homeassistant-esp32-setup.md` (future PR) and update Render env template.

This plan keeps the ingestion path deterministic, leverages existing realtime infrastructure, and honors Render free-tier limitations.
