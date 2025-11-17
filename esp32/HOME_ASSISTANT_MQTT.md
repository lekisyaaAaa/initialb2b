# Home Assistant MQTT Add-on Broker URL

## Quick Answer
Your MQTT broker URL is typically:
```
mqtt://homeassistant.local:1883
```
or
```
mqtt://[YOUR_HA_IP_ADDRESS]:1883
```

## Step-by-Step Guide

### 1. Find Your Home Assistant IP Address

**Method A: From HA Interface**
- Go to Settings → System → Network
- Look for "IPv4 address" or similar

**Method B: From Router Admin Panel**
- Log into your router (usually 192.168.1.1 or 192.168.0.1)
- Find the device list showing connected devices
- Look for your Home Assistant device

**Method C: From Command Line (if you have SSH access)**
```bash
ip addr show
# or
hostname -I
```

### 2. Check MQTT Add-on Configuration

**In Home Assistant:**
1. Go to Settings → Add-ons
2. Find the "Mosquitto broker" add-on
3. Click on it to see configuration
4. Check if authentication is enabled

### 3. MQTT Broker URL Format

**Without Authentication:**
```
mqtt://[YOUR_HA_IP]:1883
```

**With Authentication:**
```
mqtt://username:password@[YOUR_HA_IP]:1883
```

### 4. Common Home Assistant MQTT URLs

**Your specific setup:**
- `mqtt://192.168.8.142:1883` (your current HA IP)

**General examples:**
- `mqtt://homeassistant.local:1883` (if mDNS is working)
- `mqtt://192.168.1.100:1883` (replace with your HA IP)
- `mqtt://192.168.0.100:1883` (common local network)

### 5. Test Your MQTT Connection

**Install MQTT CLI tool:**
```bash
npm install -g mqtt-cli
```

**Test connection:**
```bash
# Without auth
mqtt pub -t "test" -m "hello" -h [YOUR_HA_IP] -p 1883

# With auth (if configured)
mqtt pub -t "test" -m "hello" -h [YOUR_HA_IP] -p 1883 -u username -P password
```

### 6. Home Assistant MQTT Credentials

If you have authentication enabled, check:
- **Username:** Usually `homeassistant` or custom
- **Password:** Set during MQTT add-on configuration

### 7. Firewall/Network Considerations

- Ensure port 1883 is open on your Home Assistant machine
- MQTT uses TCP, not HTTP
- If HA is behind a firewall, you may need port forwarding

### 8. ESPHome Configuration

Once you have the URL, update your ESPHome YAML:
```yaml
mqtt:
  broker: "mqtt://192.168.1.100:1883"  # Replace with your HA IP
  username: "your_username"            # If authentication enabled
  password: "your_password"            # If authentication enabled
```

### 7. Backend Configuration

**Important:** The VermiLinks backend should NOT connect directly to MQTT. Instead, configure webhook integration:

Set in your Render backend environment variables:
```
HOME_ASSISTANT_WEBHOOK_SECRET=your_webhook_secret_here
```

The data flow is: ESP32 → MQTT → HA → **Webhook** → Backend

NOT: ESP32 → MQTT → HA → Webhook → Backend + ESP32 → MQTT → Backend

## Troubleshooting

**Can't connect?**
- Verify IP address is correct
- Check if MQTT add-on is running
- Ensure no firewall blocking port 1883
- Try with/without authentication

**mDNS not working?**
- Use IP address instead of `homeassistant.local`
- Check your network's mDNS settings

**Port issues?**
- Default MQTT port is 1883
- Some configurations use 8883 for secure MQTT (mqtts://)</content>
<parameter name="filePath">c:\xampp\htdocs\beantobin\system\esp32\HOME_ASSISTANT_MQTT.md