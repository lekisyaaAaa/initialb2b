# Hardware Integration Guide

This guide provides the necessary configuration details for connecting ESP32 devices and Home Assistant to your deployed VermiLinks system.

## Home Assistant Webhook Integration

### Webhook URL
```
https://vermilinks-backend.onrender.com/api/ha/webhook
```

### Authentication
Set the `HOME_ASSISTANT_WEBHOOK_SECRET` environment variable in your Render backend service. This secret is used to validate webhook requests via HMAC-SHA256.

**Example HA Automation:**
```yaml
automation:
  - alias: "Send VermiLinks Telemetry"
    trigger:
      - platform: time_pattern
        minutes: "/5"  # Every 5 minutes
    action:
      - service: webhook.call
        data:
          webhook_id: vermilinks_telemetry
          method: POST
          headers:
            Content-Type: application/json
            X-HA-Signature: "{{ your_webhook_secret }}"
          payload: >
            {
              "deviceId": "vermilinks-homeassistant",
              "timestamp": "{{ now().isoformat() }}",
              "metrics": {
                "temperature": {{ states('sensor.temperature') }},
                "humidity": {{ states('sensor.humidity') }},
                "moisture": {{ states('sensor.moisture') }},
                "ph": {{ states('sensor.ph') }},
                "ec": {{ states('sensor.ec') }}
              },
              "source": {
                "ha_entity": "sensor.bundle",
                "automation": "telemetry_push"
              }
            }
```

### Webhook Headers
- `Content-Type: application/json`
- `X-HA-Signature: <HMAC-SHA256 signature of request body>`

### Payload Schema
```json
{
  "deviceId": "vermilinks-homeassistant",
  "timestamp": "2025-11-16T12:00:00.000Z",
  "metrics": {
    "temperature": 24.6,
    "humidity": 58.2,
    "moisture": 41.5,
    "ph": 6.8,
    "ec": 1.23,
    "nitrogen": 40,
    "phosphorus": 10,
    "potassium": 55,
    "waterLevel": 1,
    "floatSensor": 0,
    "batteryLevel": 87,
    "signalStrength": -63
  },
  "source": {
    "ha_entity": "sensor.vermilinks_bundle",
    "automation": "garden_push",
    "trace_id": "abc-123"
  }
}
```

## MQTT Broker Configuration

### MQTT Broker URL
Set the `MQTT_BROKER_URL` environment variable in your Render backend service.

**Supported formats:**
- `mqtt://broker.example.com:1883`
- `mqtts://secure-broker.example.com:8883`
- `ws://broker.example.com:9001` (WebSocket)
- `wss://secure-broker.example.com:9001` (Secure WebSocket)

**For testing, you can use the free HiveMQ public broker:**
```
mqtt://broker.hivemq.com:1883
```

**For production, consider:**
- CloudMQTT (paid service)
- AWS IoT Core
- Self-hosted Mosquitto
- See `esp32/MQTT_BROKER_SETUP.md` for complete setup guide

### MQTT Topics
Default subscription: `vermilinks/#`

**Topic Structure:**
- `vermilinks/{deviceId}/data` - Sensor data messages
- `vermilinks/{deviceId}/status` - Device status updates
- `vermilinks/{deviceId}/command` - Command responses

### MQTT Credentials (Optional)
If your MQTT broker requires authentication:
- `MQTT_USERNAME` - Broker username
- `MQTT_PASSWORD` - Broker password

### MQTT Message Format
```json
{
  "deviceId": "esp32-device-01",
  "timestamp": "2025-11-16T12:00:00.000Z",
  "metrics": {
    "temperature": 24.6,
    "humidity": 58.2,
    "moisture": 41.5,
    "ph": 6.8,
    "ec": 1.23
  },
  "metadata": {
    "firmware": "v1.2.3",
    "uptime": 3600,
    "signal": -45
  }
}
```

## ESP32 Device Configuration

### Backend API URL
```
https://vermilinks-backend.onrender.com
```

### WebSocket URL
```
wss://vermilinks-backend.onrender.com
```

### Sensor Data Endpoint
```
POST https://vermilinks-backend.onrender.com/api/sensors
```

### Device Registration
ESP32 devices should connect via WebSocket and send a registration message:
```json
{
  "type": "register",
  "deviceId": "esp32-device-01",
  "firmware": "v1.2.3"
}
```

### Quick Setup with Pre-configured YAML

For immediate deployment, use the ready-to-use configuration:

1. **Copy `esp32/knights_final.yaml`** to your ESPHome directory
2. **Replace the MQTT broker URL** in the file:
   ```yaml
   broker: "mqtt://YOUR_ACTUAL_BROKER_URL:1883"
   ```
3. **Flash to your ESP32:**
   ```bash
   esphome run knights_final.yaml
   ```

This file includes your MQTT credentials and is ready to use immediately.

### Full ESPHome Configuration

### ESPHome YAML Configuration

```yaml
esphome:
  name: knights
  friendly_name: Knights_IOT

esp32:
  board: esp32dev
  framework:
    type: arduino

# MQTT Configuration for VermiLinks backend
mqtt:
  broker: !secret mqtt_broker_url
  username: !secret mqtt_username
  password: !secret mqtt_password
  client_id: knights_esp32
  discovery: false
  topic_prefix: vermilinks/knights
  birth_message:
    topic: vermilinks/knights/status
    payload: online
  will_message:
    topic: vermilinks/knights/status
    payload: offline
  on_message:
    topic: vermilinks/knights/command
    then:
      - lambda: |-
          ESP_LOGD("mqtt", "Received command: %s", x.c_str());
          // Parse command JSON and execute
          auto payload = x;
          if (payload.find("\"pump\":\"on\"") != std::string::npos) {
            id(vermilinks_esp32_water_pump).turn_on();
          } else if (payload.find("\"pump\":\"off\"") != std::string::npos) {
            id(vermilinks_esp32_water_pump).turn_off();
          } else if (payload.find("\"valve1\":\"pulse\"") != std::string::npos) {
            id(solenoid_valve_1_pulse).turn_on();
          } else if (payload.find("\"valve2\":\"pulse\"") != std::string::npos) {
            id(solenoid_valve_2_pulse).turn_on();
          } else if (payload.find("\"valve3\":\"pulse\"") != std::string::npos) {
            id(solenoid_valve_3_pulse).turn_on();
          }

# ... rest of your existing configuration (wifi, api, ota, etc.)

# Add MQTT publishers for sensor data
text_sensor:
  - platform: template
    id: mqtt_publish_float
    on_value:
      then:
        - mqtt.publish_json:
            topic: vermilinks/knights/data
            payload: |-
              {
                "deviceId": "knights",
                "timestamp": "{{ now().isoformat() }}",
                "metrics": {
                  "floatSensor": {{ x | int }},
                  "waterLevel": {{ x | int }}
                },
                "metadata": {
                  "firmware": "esphome-v1.0",
                  "uptime": {{ uptime_sensor.state }},
                  "signal": {{ wifi_signal_sensor.state }}
                }
              }

# Add MQTT publishing to your switches
switch:
  - platform: gpio
    id: vermilinks_esp32_water_pump
    name: "VermiLinks ESP32 Water Pump"
    pin: 5
    restore_mode: ALWAYS_OFF
    on_turn_on:
      - mqtt.publish_json:
          topic: vermilinks/knights/status
          payload: |-
            {
              "deviceId": "knights",
              "pump": "on",
              "timestamp": "{{ now().isoformat() }}"
            }
    on_turn_off:
      - mqtt.publish_json:
          topic: vermilinks/knights/status
          payload: |-
            {
              "deviceId": "knights",
              "pump": "off",
              "timestamp": "{{ now().isoformat() }}"
            }

# ... rest of your solenoid valve configurations with MQTT publishing added
```

### ESPHome Secrets Configuration

Create a `secrets.yaml` file in your ESPHome directory:

```yaml
# ESPHome Secrets for Knights ESP32
mqtt_broker_url: "mqtt://your-mqtt-broker.example.com:1883"
mqtt_username: "your_mqtt_username"
mqtt_password: "your_mqtt_password"
```

### MQTT Topics Used

- **Data Publishing:** `vermilinks/knights/data` - Sensor data and telemetry
- **Status Updates:** `vermilinks/knights/status` - Device status and state changes
- **Command Reception:** `vermilinks/knights/command` - Remote control commands

### Backend Environment Variables

Set these in your Render backend service for MQTT support:

- `MQTT_BROKER_URL` - Your MQTT broker URL (e.g., `mqtt://broker.example.com:1883`)
- `MQTT_USERNAME` - Optional broker authentication
- `MQTT_PASSWORD` - Optional broker authentication
- `MQTT_SUBSCRIPTIONS` - Topic pattern to subscribe to (default: `vermilinks/#`)

## Alert Thresholds Configuration

Default alert thresholds are configured via the `ALERT_THRESHOLDS_JSON` environment variable:

```json
{
  "temperature": {
    "min": 10,
    "max": 35,
    "warning": 30,
    "critical": 40
  },
  "humidity": {
    "min": 20,
    "max": 90,
    "warning": 80,
    "critical": 95
  },
  "moisture": {
    "min": 10,
    "max": 80,
    "warning": 20,
    "critical": 15
  },
  "ph": {
    "minWarning": 5.5,
    "minCritical": 5.0,
    "maxWarning": 7.5,
    "maxCritical": 8.0
  },
  "ec": {
    "min": 0.5,
    "max": 3.0,
    "warning": 2.5,
    "critical": 4.0
  }
}
```

These can be updated via the admin dashboard at `/admin/dashboard` under Settings.

## Health Check Endpoints

### API Health
```
GET https://vermilinks-backend.onrender.com/api/health
```

### Admin Alerts
```
GET https://vermilinks-backend.onrender.com/api/admin/alerts
Authorization: Bearer <JWT_TOKEN>
```

### WebSocket Connection Test
Use the WebSocket URL: `wss://vermilinks-backend.onrender.com`

## Environment Variables Summary

### Required for Production
- `HOME_ASSISTANT_WEBHOOK_SECRET` - Secret for webhook HMAC validation
- `MQTT_BROKER_URL` - MQTT broker connection string (if using MQTT)
- `JWT_SECRET` - Random secret for JWT token signing
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Render)

### Optional
- `MQTT_USERNAME` - MQTT broker username
- `MQTT_PASSWORD` - MQTT broker password
- `MQTT_SUBSCRIPTIONS` - MQTT topic subscriptions (default: `vermilinks/#`)
- `ALERT_THRESHOLDS_JSON` - Custom alert thresholds

## Testing Your Integration

1. **Webhook Test:**
   ```bash
   curl -X POST https://vermilinks-backend.onrender.com/api/ha/webhook \
     -H "Content-Type: application/json" \
     -H "X-HA-Signature: <your-signature>" \
     -d '{"deviceId":"test","metrics":{"temperature":25}}'
   ```

2. **Health Check:**
   ```bash
   curl https://vermilinks-backend.onrender.com/api/health
   ```

3. **WebSocket Test:**
   ```bash
   node backend/scripts/ws-device-sim.js wss://vermilinks-backend.onrender.com test-device
   ```

4. **Admin Login Test:**
   ```bash
   curl -X POST https://vermilinks-backend.onrender.com/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"email":"your-admin@example.com","password":"your-password"}'
   ```</content>
<parameter name="filePath">c:\xampp\htdocs\beantobin\system\docs\HARDWARE_INTEGRATION.md