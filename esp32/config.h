#pragma once

// Wi-Fi credentials for the field deployment
#define WIFI_SSID "Knights_IOT"
#define WIFI_PASS "smbcr-5540"

// Backend endpoints
#define SENSOR_POST_URL "https://vermilinks-backend.onrender.com/api/sensors"
#define COMMAND_QUEUE_URL "https://vermilinks-backend.onrender.com/api/command"
#define COMMAND_POLL_URL "https://vermilinks-backend.onrender.com/api/device-commands/next"
#define COMMAND_ACK_BASE_URL "https://vermilinks-backend.onrender.com/api/device-commands"

// Device metadata
#define DEVICE_ID "ESP32-01"

// Command retry configuration (milliseconds)
#define COMMAND_RETRY_DELAY_MS 500
#define COMMAND_MAX_RETRIES 3
