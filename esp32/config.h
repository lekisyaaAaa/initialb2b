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

// RS485 / Modbus configuration (change pins to match your wiring)
#define RS485_RX_PIN 17
#define RS485_TX_PIN 18
#define RS485_DE_PIN 4
#define RS485_BAUD 9600
#define RS485_MODBUS_ID 1

/*
RS485 module wiring (5-pin TTL side) → ESP32 mapping
	Use a 3.3V RS485 transceiver (e.g., MAX3485/SP3485/SN65HVD series). If your module is
	5V-only (MAX485 breakout), power at 5V and ensure RO/DI levels are 3.3V-safe or use level shifting.

	Module pin        → ESP32
	-------------------------------------------
	RO  (Receiver Out) → RS485_RX_PIN (GPIO17)
	DI  (Driver In)    → RS485_TX_PIN (GPIO18)
	RE/DE (enable)     → RS485_DE_PIN (GPIO4)
	VCC                → 3V3 (or 5V if module requires and is level-safe)
	GND                → GND

Notes:
	- If your module breaks out RE and DE separately (6 pins), tie RE and DE together and drive both
		from RS485_DE_PIN so the firmware can toggle TX/RX direction.
	- Bus side (screw terminals): connect A ↔ Sensor A, B ↔ Sensor B. If no comms, swap A/B.
	- Termination/bias: enable 120Ω termination at the two physical ends of the bus only; apply biasing
		(pull-up on A, pull-down on B) to keep the line idle when no driver is active.
	- Configure RS485_BAUD/Parity in firmware to match your device. RS485_MODBUS_ID must match the device's
		Modbus address (Unit ID).
*/
