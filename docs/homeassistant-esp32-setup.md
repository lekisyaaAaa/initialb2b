# Home Assistant & ESP32 Integration Guide

This guide explains how to connect the ESP32-based environmental monitor to your Home Assistant instance (or direct backend server) so that sensor data is ingested in real time and actuator controls (pump/valve) operate from the dashboard.

---

## 1. Overview

- **ESP32** (running `esp32/environmental_monitor.ino`) publishes sensor readings every 5 minutes (configurable) to your backend API and receives actuator control commands via HTTP/REST (optional) or MQTT.
- **Backend (Node.js server)** exposes `/api/sensors` and `/api/actuators` endpoints that store, broadcast, and respond to dashboard actions.
- **Home Assistant** can either act as the backend or subscribe to the backend's socket feed. This guide covers both options.

---

## 2. Requirements

### Hardware
- ESP32 dev board with the RS485 sensors, EC probe, NPK sensor, water level sensor, pump and valve relays wired.
- MAX485 module for RS485 communication.
- 5V/12V power supply for relays and sensors as needed.

### Software
- Arduino IDE (or VS Code with PlatformIO) with ESP32 board support installed.
- **Required Arduino libraries** (install via *Sketch → Include Library → Manage Libraries…*):
   - `ArduinoJson` by Benoit Blanchon (version 6.x or newer)
   - `WiFi` (bundled with the ESP32 core)
   - `HTTPClient` (bundled with the ESP32 core)
- Running backend (`npm run backend` inside `system/backend`).
- Home Assistant instance (optional, for Step 5).

> **CLI alternative:** if you use the Arduino CLI, install dependencies with:
> ```bash
> arduino-cli lib install ArduinoJson
> ```

---

## 3. Prepare the ESP32 Sketch

1. Open `esp32/environmental_monitor.ino` in Arduino IDE.
2. Adjust Wi-Fi credentials:
   ```cpp
   const char* WIFI_SSID = "YOUR_SSID";
   const char* WIFI_PASSWORD = "YOUR_PASSWORD";
   ```
3. Set backend URL to your server IP:
   ```cpp
   const char* BACKEND_URL = "http://<backend-ip>:5000/api/sensors";
   ```
4. Optional: adjust thresholds, data send interval (`300000UL`), or device ID.
5. Confirm the required libraries are installed (see Requirements above) and upload the sketch to the ESP32.

**Tip:** If you need to send actuator states, extend `sendReading` or add an `/api/actuators` call when the pump/valve toggles.

---

## 4. Backend Configuration

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Ensure environment variables are set (adjust `.env` if present):
   - `PORT=5000`
   - `DB_CONNECTION=sqlite://./db/database.sqlite` (or your Postgres connection)
3. Run migrations/seeds if required. Example (if a script exists):
   ```bash
   node migrate-users-to-pg.js
   ```
4. Start backend:
   ```bash
   npm start
   ```
5. Confirm `/api/sensors` accepts POST data and `/socket.io` streams events. Use Postman or curl to verify.

**Socket broadcasting:** The backend pushes `sensorSnapshot` and `newSensorData` events which the dashboard consumes.

---

## 5. Home Assistant Integration (Optional)

### Option A: Home Assistant as the Main Backend

1. Install MQTT broker (e.g., Mosquitto) on your HA server.
2. Modify ESP32 sketch to publish via MQTT:
   - Include `PubSubClient` library.
   - Define MQTT broker credentials.
   - Publish JSON payloads to a topic like `beantobin/sensors/esp32-001`.
3. In Home Assistant `configuration.yaml`:
   ```yaml
   mqtt:
     broker: 192.168.x.x
   sensor:
     - platform: mqtt
       name: "BeanToBin Temperature"
       state_topic: "beantobin/sensors/esp32-001"
       unit_of_measurement: "°C"
       value_template: "{{ value_json.temperature_c }}"
   ```
4. To control pump/valve, define `switch` entities that publish to `beantobin/actuators/esp32-001` and add MQTT subscription logic on the ESP32.

### Option B: Home Assistant Consumes Backend Data

1. Keep backend as central API.
2. Install `rest` platform sensors (or WebSocket integration) in Home Assistant:
   ```yaml
   rest:
     - resource: http://<backend-ip>:5000/api/sensors/latest
       scan_interval: 60
       sensor:
         - name: "BeanToBin Temperature"
           value_template: "{{ value_json.temperature }}"
   ```
   Adjust paths to match actual backend endpoints.
3. For actuators, expose backend endpoints (e.g., `/api/actuators`) and configure HA `rest_command` or `button` integrators to call them.
4. Example `rest_command` in Home Assistant to start pump:
   ```yaml
   rest_command:
     pump_start:
       url: http://<backend-ip>:5000/api/actuators/pump
       method: post
       payload: '{"state": "ON"}'
   ```
5. Create `button` or `switch` entity linking to `rest_command` for UI control.

---

## 6. Real-Time Dashboard Updates

- The React dashboard uses Socket.IO (`sensorSnapshot`, `newSensorData`). Ensure the backend socket is reachable from your frontend host.
- If hosting separately, enable CORS or accessible domain.

### Testing Steps

1. Run the backend: `npm run backend` (from root `npm run backend`). Ensure no DB errors.
2. Run the frontend: `npm run frontend` (port 3002). Confirm `Dashboard` loads.
3. Power the ESP32. Watch Serial Monitor for log outputs.
4. Verify backend logs show sensor POSTs.
5. Confirm dashboard updates when new data arrives.
6. Test pump/valve toggling from your Home Assistant or backend to ensure the ESP32 receives commands (requires MQTT or http logic on the microcontroller).

---

## 7. Troubleshooting

- **No data**: Check Wi-Fi connection, ensure the IP/ports are correct, inspect backend logs.
- **Socket errors**: Confirm `REACT_APP_SOCKET_URL` matches backend host; check CORS.
- **Actuators not responding**: Ensure relays are wired correctly, driver pins set, and microcontroller logic toggles them on command.
- **ESP32 resets**: Provide stable power (use USB or recommended supply).

---

## 8. Next Steps

- Add OTA updates for remote firmware changes.
- Secure backend (auth tokens) and HTTPS.
- Buffer and retry on Wi-Fi loss.
- Add more sensors or advanced analytics (machine learning for optimal compost control).

---

**Contacts**
- Hardware support: hardware@beantobin.org
- Backend/API support: backend@beantobin.org
- Home Assistant integration: ha@beantobin.org
