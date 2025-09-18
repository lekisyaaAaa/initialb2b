ESP32 → Backend Payload

Send JSON POST to `http://<server>/api/sensors` with Content-Type `application/json`.

Example payload:

{
  "deviceId": "esp32-1",
  "temperature": 25.3,
  "humidity": 62.1,
  "moisture": 48.5,
  "ph": 6.8,
  "ec": 1.25,
  "nitrogen": 12.3,
  "phosphorus": 4.5,
  "potassium": 8.7,
  "waterLevel": 120,
  "batteryLevel": 3.7,
  "signalStrength": -67,
  "timestamp": "2025-09-19T00:00:00.000Z"
}

Notes:
- `waterLevel` is an integer representing sensor units; dashboard converts deltas to liters using a configurable calibration value.
- For offline mode, batch uploads are accepted at `POST /api/sensors/batch` with `deviceId` and `data: []`.
- The route responds with 201 on success and broadcasts data to WebSocket clients if available.
