#pragma once

// Wi-Fi credentials
#define WIFI_SSID "YourSSID"
#define WIFI_PASS "YourPassword"

// Backend endpoints
#define SERVER_URL "https://your-backend-domain/api/sensors"
#define HEARTBEAT_URL "https://your-backend-domain/api/devices/heartbeat"
#define COMMAND_ACK_URL "https://your-backend-domain/api/devices/ack"

// Device metadata
#define DEVICE_ID "ESP32_001"

// Command retry configuration
#define COMMAND_RETRY_DELAY_MS 250
#define COMMAND_MAX_RETRIES 2
