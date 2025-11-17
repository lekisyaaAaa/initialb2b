# MQTT Broker Setup Guide for VermiLinks

## Option 1: Home Assistant MQTT Add-on (Recommended if you have HA)

**If you already have Home Assistant with MQTT add-on:**

1. **Find your HA IP address:**
   - HA Settings → System → Network → IPv4 address
   - Or check your router's device list

2. **MQTT Broker URL:**
   ```
   mqtt://[YOUR_HA_IP_ADDRESS]:1883
   ```
   Example: `mqtt://192.168.1.100:1883`

3. **Check authentication:**
   - HA Settings → Add-ons → Mosquitto broker
   - If auth enabled, get username/password from configuration

**Pros:** Already running, secure local network, integrated with HA
**Cons:** Requires network access from ESP32 to HA

## Option 2: Free Public MQTT Broker (Easiest)

**Use HiveMQ Public Broker:**
```
mqtt://broker.hivemq.com:1883
```

**Pros:** Free, no setup required, works immediately
**Cons:** Public broker, shared with others, no authentication

## Option 2: CloudMQTT (Paid but Reliable)

1. Go to https://www.cloudmqtt.com/
2. Sign up for free tier
3. Create an instance
4. Get your connection details:
   ```
   mqtt://username:password@server.cloudmqtt.com:port
   ```

## Option 3: Eclipse Mosquitto (Self-Hosted)

### Using Docker (Recommended):
```bash
# Run Mosquitto MQTT broker
docker run -d -p 1883:1883 -p 9001:9001 --name mosquitto eclipse-mosquitto
```

**Broker URL:** `mqtt://localhost:1883` (if running locally)

### Using Render Service:
Add a new web service in Render with:
- **Runtime:** Docker
- **Dockerfile:**
  ```dockerfile
  FROM eclipse-mosquitto
  COPY mosquitto.conf /mosquitto/config/mosquitto.conf
  ```

## Option 4: AWS IoT Core (Enterprise)

If you need enterprise-grade MQTT:
1. AWS IoT Core console
2. Create a thing/policy
3. Get certificates and endpoint
4. Use format: `mqtts://your-endpoint.amazonaws.com:8883`

## For Your VermiLinks System

### Current Setup Recommendation:

**Use HiveMQ Public Broker for testing:**
```
broker: "mqtt://broker.hivemq.com:1883"
```

### Production Setup (Recommended):

1. **Set up CloudMQTT or similar**
2. **Update your Render environment variables:**
   - `MQTT_BROKER_URL=mqtt://your-broker-url:1883`
   - `MQTT_USERNAME=your_username`
   - `MQTT_PASSWORD=your_password`

3. **Update ESPHome YAML:**
   ```yaml
   mqtt:
     broker: "mqtt://your-broker-url:1883"
     username: "your_username"
     password: "your_password"
   ```

## Testing Your MQTT Connection

### Install MQTT CLI:
```bash
npm install -g mqtt-cli
```

### Test Publishing:
```bash
mqtt pub -t "vermilinks/knights/data" -m '{"deviceId":"test","metrics":{"temp":25}}' -h broker.hivemq.com
```

### Test Subscribing:
```bash
mqtt sub -t "vermilinks/#" -h broker.hivemq.com
```

## Security Notes

- **Public brokers** are fine for testing but not production
- **Use authentication** when possible
- **Consider TLS** (mqtts://) for production
- **Firewall** your MQTT broker appropriately

## Quick Start for Testing

Just replace in your YAML:
```yaml
broker: "mqtt://broker.hivemq.com:1883"
```

And set in Render:
```
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883
```</content>
<parameter name="filePath">c:\xampp\htdocs\beantobin\system\esp32\MQTT_BROKER_SETUP.md