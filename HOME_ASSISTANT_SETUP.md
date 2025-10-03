# Home Assistant + ESPHome Integration Setup

## Overview
This system now supports Home Assistant + ESPHome integration, which provides a much more robust and user-friendly IoT solution compared to direct ESP32 programming.

## Architecture
```
ESP32 (ESPHome Firmware) → Home Assistant → Backend API → Database → Frontend Dashboard
```

## Setup Steps

### 1. Install Home Assistant
```bash
# Using Docker (recommended)
docker run -d \
  --name homeassistant \
  --privileged \
  --restart=unless-stopped \
  -v /path/to/config:/config \
  -v /etc/localtime:/etc/localtime:ro \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable
```

### 2. Configure Home Assistant
1. Access HA at `http://localhost:8123`
2. Complete initial setup
3. Create a Long-Lived Access Token:
   - Go to Profile → Security → Long-lived access tokens
   - Create token: "BeanToBin Environmental System"

### 3. Install ESPHome Add-on
1. In HA: Settings → Add-ons → Add-on Store
2. Search for "ESPHome" and install
3. Start the ESPHome add-on

### 4. Configure ESPHome Devices
1. Access ESPHome dashboard at `http://homeassistant.local:6052`
2. Create new device for each ESP32
3. Configure sensors (temperature, humidity, moisture, pH, etc.)
4. Flash firmware to ESP32 devices

### 5. Backend Configuration
Update your `.env` file with Home Assistant settings:

```env
# Home Assistant Integration
HA_BASE_URL=http://homeassistant.local:8123
HA_TOKEN=your_long_lived_access_token_here
HA_ENTITY_FILTER=sensor.esphome_

# Sensor Poller Configuration
POLL_MS=30000
USE_HA_POLLER=true
```

### 6. Update Server to Use HA Poller
Modify `backend/server.js` or `backend/server_pg.js` to use the HA poller:

```javascript
// Replace the existing sensor poller import
// const sensorPoller = require('./services/sensor-poller');
const sensorPoller = require('./services/sensor-poller-ha');

// Start the HA-aware poller
if (process.env.USE_HA_POLLER === 'true') {
  sensorPoller.start().catch(console.error);
}
```

## ESPHome Device Configuration Example

```yaml
esphome:
  name: greenhouse-sensor-01
  platform: ESP32
  board: esp32dev

wifi:
  ssid: "YourWiFi"
  password: "YourPassword"

# Enable logging
logger:

# Enable Home Assistant API
api:

# Enable OTA updates
ota:

# Sensors configuration
sensor:
  - platform: dht
    pin: GPIO4
    temperature:
      name: "Greenhouse Temperature"
    humidity:
      name: "Greenhouse Humidity"
    update_interval: 30s

  - platform: adc
    pin: GPIO34
    name: "Soil Moisture"
    update_interval: 30s

  - platform: adc
    pin: GPIO35
    name: "pH Level"
    update_interval: 30s
```

## Benefits of HA + ESPHome Integration

### ✅ **Advantages:**
- **Easier Device Management**: Web-based ESPHome dashboard
- **Robust Communication**: Home Assistant handles device connectivity
- **Rich Features**: OTA updates, device tracking, automation
- **Better Reliability**: HA provides connection monitoring and recovery
- **Extensible**: Easy to add new sensors and devices
- **Community Support**: Large ESPHome and HA communities

### ✅ **Data Flow:**
1. ESPHome devices automatically report to Home Assistant
2. Backend polls HA REST API every 30 seconds
3. Sensor data normalized and stored in database
4. Frontend displays real-time data from HA devices

### ✅ **Automatic Device Discovery:**
- Backend automatically finds all ESPHome sensors
- No manual device registration needed
- Device status monitoring built-in

## Testing the Integration

### 1. Check HA Connection
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://homeassistant.local:8123/api/states
```

### 2. Check ESPHome Devices
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://homeassistant.local:8123/api/states | \
     jq '.[] | select(.entity_id | startswith("sensor.esphome_"))'
```

### 3. Test Backend Poller
```bash
curl http://localhost:5000/internal/sensor-agg
```

## Troubleshooting

### Common Issues:

**HA Connection Failed:**
- Check HA_TOKEN is correct
- Verify HA is running and accessible
- Check firewall settings

**No ESPHome Sensors Found:**
- Ensure ESPHome devices are configured and connected
- Check entity_id naming convention
- Verify HA_ENTITY_FILTER setting

**Data Not Appearing:**
- Check backend logs for poller errors
- Verify HA API responses
- Check database connectivity

## Migration from Direct ESP32

If you're currently using direct ESP32 connections, the migration is straightforward:

1. **Keep existing backend running** during transition
2. **Set up HA + ESPHome** alongside
3. **Update environment variables** to use HA poller
4. **Test data flow** from HA devices
5. **Decommission direct ESP32** connections when ready

The system is designed to be backward compatible, so you can run both polling methods simultaneously during migration.