#pragma once

// Wi-Fi credentials for the field deployment
#define WIFI_SSID "Knights_IOT"
#define WIFI_PASS "smbcr-5540"

// Backend endpoints
#define SENSOR_POST_URL "https://vermilinks-backend.onrender.com/api/sensors"
#define COMMAND_QUEUE_URL "https://vermilinks-backend.onrender.com/api/command"
#define COMMAND_POLL_URL "https://vermilinks-backend.onrender.com/api/device-commands/next"
#define COMMAND_ACK_BASE_URL "https://vermilinks-backend.onrender.com/api/device-commands"
// Device config endpoint for threshold sync
#define CONFIG_URL "https://vermilinks-backend.onrender.com/api/config"

// Device metadata
#define DEVICE_ID "ESP32-01"

// Command retry configuration (milliseconds)
#define COMMAND_RETRY_DELAY_MS 500
#define COMMAND_MAX_RETRIES 3

// Hardware pin mapping (default field deployment)
// FLOAT_SENSOR_PIN is active-high: HIGH => float present (safe)
#define FLOAT_SENSOR_PIN 16
#define PUMP_PIN 5

// Solenoid pins
#define SOLENOID_PIN_1 25
#define SOLENOID_PIN_2 26
#define SOLENOID_PIN_3 27
