# 🚀 Quick ESP32 Setup for VermiLinks

## Step 1: Get the Ready-to-Use YAML
Copy the entire contents of `esp32/knights_final.yaml` from this repository.

## Step 2: Replace MQTT Broker URL

**For Your Home Assistant Setup:**
```yaml
broker: "mqtt://192.168.8.142:1883"
```

**For Testing (Free & Easy):**
```yaml
broker: "mqtt://broker.hivemq.com:1883"
```

**For Production (Recommended):**
Choose from these options:

### Option A: CloudMQTT (Paid)
1. Go to https://www.cloudmqtt.com/
2. Create free account
3. Get your instance URL like: `mqtt://username:password@server.cloudmqtt.com:port`

### Option B: Self-Hosted (Free)
```bash
# Run local MQTT broker
docker run -d -p 1883:1883 --name mosquitto eclipse-mosquitto
```
Then use: `mqtt://localhost:1883`

### Option C: AWS IoT Core (Enterprise)
Use AWS console to create IoT Core endpoint.

## Step 3: Flash to ESP32
1. Open ESPHome Dashboard
2. Create new device
3. Paste the modified YAML
4. Click "Install" → "Manual download"
5. Select your ESP32 and flash

## Step 4: Backend Configuration
**DO NOT set MQTT environment variables in the backend** - HA handles MQTT subscription and forwards data via webhooks.

Set only these webhook-related environment variables in your Render backend:
```
HOME_ASSISTANT_WEBHOOK_SECRET=your_webhook_secret_here
```

The backend receives data via webhooks from HA, not direct MQTT connection.

## ✅ Done!
Your ESP32 will now connect via MQTT and publish sensor data to VermiLinks.

## Troubleshooting
- **Can't connect?** Verify MQTT broker URL and credentials
- **No data in dashboard?** Check backend environment variables
- **ESP32 not responding?** Check WiFi connection and MQTT broker availability

## Full Setup Guide
See `MQTT_BROKER_SETUP.md` for complete MQTT broker options and setup instructions.</content>
<parameter name="filePath">c:\xampp\htdocs\beantobin\system\esp32\QUICK_SETUP.md