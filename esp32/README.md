# ESP32 Configuration for VermiLinks

This directory contains ESP32 firmware configurations for the VermiLinks environmental monitoring system.

## Quick Start - Copy & Paste YAML

**For immediate use, copy the entire contents of `knights_final.yaml`** and paste it into your ESPHome dashboard.

**⚠️ IMPORTANT:** Before flashing, you MUST replace this line in the YAML:
```yaml
broker: "mqtt://your-mqtt-broker.example.com:1883"  # ⚠️  REPLACE THIS WITH YOUR ACTUAL MQTT BROKER URL
```

Replace `your-mqtt-broker.example.com:1883` with your actual MQTT broker address and port.

## Files

- `config.h` - Arduino IDE configuration for traditional ESP32 firmware
- `knights_mqtt.yaml` - ESPHome configuration with MQTT support (uses secrets)
- `knights_final.yaml` - **READY-TO-USE** ESPHome config (copy & paste directly)
- `secrets.yaml` - ESPHome secrets template (copy and customize)
- `README.md` - This file

## MQTT Credentials

Your MQTT credentials are already configured in the final YAML:
- **Username:** `Knights_IOT`
- **Password:** `smbcr-5540`

## ESPHome MQTT Configuration

The `knights_mqtt.yaml` file provides a complete ESPHome configuration that includes:

### Features
- ✅ **MQTT Connectivity** - Direct communication with VermiLinks backend
- ✅ **Water Pump Control** - GPIO5 relay control with auto/manual modes
- ✅ **Solenoid Valves** - 3 valves (GPIO25, 26, 27) with pulse control
- ✅ **Float Sensor** - Water level detection (GPIO14)
- ✅ **WiFi & Fallback AP** - Reliable connectivity
- ✅ **OTA Updates** - Over-the-air firmware updates
- ✅ **Status Publishing** - Real-time device status via MQTT

### MQTT Topics

**Publishing Topics:**
- `vermilinks/knights/data` - Sensor data and telemetry (every 5 minutes)
- `vermilinks/knights/status` - Device status and state changes

**Subscribing Topics:**
- `vermilinks/knights/command` - Remote control commands from backend

### Setup Instructions

1. **Install ESPHome:**
   ```bash
   pip install esphome
   ```

2. **Configure Secrets:**
   ```bash
   cp secrets.yaml secrets.local.yaml
   # Edit secrets.local.yaml with your MQTT broker details
   ```

3. **Set MQTT Broker URL:**
   In `secrets.local.yaml`:
   ```yaml
   mqtt_broker_url: "mqtt://your-broker.example.com:1883"
   mqtt_username: "your_username"
   mqtt_password: "your_password"
   ```

4. **Flash to ESP32:**
   ```bash
   esphome run knights_mqtt.yaml --secrets secrets.local.yaml
   ```

### Backend Configuration

Ensure your Render backend has these environment variables set:

- `MQTT_BROKER_URL` - Same broker URL as ESP32
- `MQTT_USERNAME` - Optional authentication
- `MQTT_PASSWORD` - Optional authentication
- `MQTT_SUBSCRIPTIONS=vermilinks/#` (default)

### MQTT Message Examples

**Sensor Data Publishing:**
```json
{
  "deviceId": "knights",
  "timestamp": "2025-11-16T12:00:00.000Z",
  "metrics": {
    "floatSensor": 1,
    "waterLevel": 1
  },
  "metadata": {
    "firmware": "esphome-v1.0",
    "uptime": 3600,
    "signal": -45
  }
}
```

**Status Updates:**
```json
{
  "deviceId": "knights",
  "pump": "on",
  "timestamp": "2025-11-16T12:00:00.000Z"
}
```

**Command Reception:**
```json
{
  "pump": "on",
  "valve1": "pulse"
}
```

### Device ID

The device publishes as `knights` (configured in the YAML). Update the `name` and `topic_prefix` in the YAML if you want a different device ID.

### Testing

1. **Monitor MQTT Messages:**
   ```bash
   mosquitto_sub -h your-broker.example.com -t "vermilinks/knights/#"
   ```

2. **Send Test Commands:**
   ```bash
   mosquitto_pub -h your-broker.example.com -t "vermilinks/knights/command" -m '{"pump":"on"}'
   ```

3. **Check Backend Logs:**
   - ESP32 data should appear in the VermiLinks dashboard
   - Commands from the dashboard should control the ESP32

### Troubleshooting

- **MQTT Connection Issues:** Verify broker URL and credentials in `secrets.yaml`
- **No Data in Dashboard:** Check device ID matches backend expectations
- **Commands Not Working:** Ensure MQTT topics match between ESP32 and backend
- **WiFi Issues:** ESP32 will create fallback AP "VermiLinks_Fallback" if WiFi fails

### Security Notes

- Use secure MQTT (mqtts://) in production
- Change default passwords in the YAML
- Consider MQTT authentication for production deployments</content>
<parameter name="filePath">c:\xampp\htdocs\beantobin\system\esp32\README.md