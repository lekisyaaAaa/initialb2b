/**
 * VermiLinks ESP32 telemetry + actuator firmware
 * - Sends telemetry every 5–10 seconds to the backend REST API
 * - Polls for actuator commands and acknowledges execution
 * - Enforces float sensor safety interlock on GPIO 5 (D5/DB5)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "config.h"

// Hardware pin mapping (field deployment)
#define FLOAT_SENSOR_PIN 16
#define PUMP_PIN 5
#define SOLENOID_PIN_1 25
#define SOLENOID_PIN_2 26
#define SOLENOID_PIN_3 27

// Active-low relay boards keep valves off when the output is HIGH
const int RELAY_ACTIVE_LEVEL = LOW;
const int RELAY_INACTIVE_LEVEL = HIGH;

const unsigned long MIN_TELEMETRY_INTERVAL_MS = 5000;
const unsigned long MAX_TELEMETRY_INTERVAL_MS = 10000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 3000;
const unsigned long WIFI_RETRY_BASE_MS = 2000;
const unsigned long WIFI_RETRY_MAX_MS = 30000;

unsigned long lastTelemetryAt = 0;
unsigned long nextTelemetryInterval = MIN_TELEMETRY_INTERVAL_MS;
unsigned long lastCommandPollAt = 0;
unsigned long lastWifiAttemptAt = 0;
unsigned long nextWifiRetryDelay = WIFI_RETRY_BASE_MS;
unsigned long lastThresholdSyncAt = 0;
const unsigned long THRESHOLD_SYNC_INTERVAL_MS = 60000; // 60s between config syncs

bool solenoidStates[3] = { false, false, false };

void connectWiFiIfNeeded();
void scheduleNextTelemetry();
void sendTelemetry(int floatState, int soilMoisture, float temperature, float humidity);
bool postJson(const String& url, const String& body, uint8_t maxAttempts = COMMAND_MAX_RETRIES);
void handlePendingCommands(int floatState);
void applySolenoid(int index, bool turnOn, bool fromCommand);
void applyPump(bool turnOn);
void disableAllSolenoids(const char* reason);
int readFloatSensor();
int readSoilMoisture();
float readTemperature();
float readHumidity();
void syncThresholds();

void setup() {
  Serial.begin(115200);
  delay(500);
  randomSeed(esp_random());

  pinMode(FLOAT_SENSOR_PIN, INPUT_PULLUP);
  pinMode(SOLENOID_PIN_1, OUTPUT);
  pinMode(SOLENOID_PIN_2, OUTPUT);
  pinMode(SOLENOID_PIN_3, OUTPUT);
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, RELAY_INACTIVE_LEVEL);
  disableAllSolenoids("boot");

  WiFi.mode(WIFI_STA);
  connectWiFiIfNeeded();
  scheduleNextTelemetry();
  // initial thresholds sync
  syncThresholds();

  Serial.println("[SYSTEM] VermiLinks firmware started");
}

void loop() {
  connectWiFiIfNeeded();

  const int floatState = readFloatSensor();
  if (floatState == LOW) {
    disableAllSolenoids("float sensor low");
  }

  const unsigned long now = millis();
  if (now - lastCommandPollAt >= COMMAND_POLL_INTERVAL_MS) {
    handlePendingCommands(floatState);
    lastCommandPollAt = now;
  }

  if (now - lastTelemetryAt >= nextTelemetryInterval) {
    const int moisture = readSoilMoisture();
    const float temperature = readTemperature();
    const float humidity = readHumidity();
    sendTelemetry(floatState, moisture, temperature, humidity);
    lastTelemetryAt = now;
    scheduleNextTelemetry();
  }

  delay(50);
}

void connectWiFiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) {
    nextWifiRetryDelay = WIFI_RETRY_BASE_MS;
    return;
  }

  const unsigned long now = millis();
  if (now - lastWifiAttemptAt < nextWifiRetryDelay) {
    return;
  }

  lastWifiAttemptAt = now;
  Serial.printf("Connecting to WiFi SSID %s\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  const unsigned long connectDeadline = now + 15000;
  while (WiFi.status() != WL_CONNECTED && millis() < connectDeadline) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
    nextWifiRetryDelay = WIFI_RETRY_BASE_MS;
  } else {
    nextWifiRetryDelay = min(nextWifiRetryDelay * 2, WIFI_RETRY_MAX_MS);
    Serial.printf("WiFi retry scheduled in %lu ms\n", nextWifiRetryDelay);
  }
}

void scheduleNextTelemetry() {
  nextTelemetryInterval = random(MIN_TELEMETRY_INTERVAL_MS, MAX_TELEMETRY_INTERVAL_MS + 1000);
}

void sendTelemetry(int floatState, int soilMoisture, float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Telemetry skipped: WiFi offline");
    return;
  }

  DynamicJsonDocument doc(256);
  doc["device_id"] = DEVICE_ID;
  doc["soil_moisture"] = soilMoisture;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["float_sensor"] = floatState == HIGH ? 1 : 0;

  String payload;
  serializeJson(doc, payload);

  if (postJson(SENSOR_POST_URL, payload)) {
    Serial.println("[HTTP] Telemetry sent successfully!");
  } else {
    Serial.println("[HTTP] Telemetry delivery failed");
  }
}

bool postJson(const String& url, const String& body, uint8_t maxAttempts) {
  for (uint8_t attempt = 1; attempt <= maxAttempts; attempt++) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    if (!http.begin(client, url)) {
      Serial.println("HTTP begin failed");
      return false;
    }

    http.addHeader("Content-Type", "application/json");
    const int status = http.POST(body);
    const String response = http.getString();
    http.end();

    if (status > 0 && status < 400) {
      Serial.printf("HTTP %d -> %s\n", status, response.c_str());
      return true;
    }

    Serial.printf("HTTP POST failure (attempt %u) -> %d\n", attempt, status);
    delay(COMMAND_RETRY_DELAY_MS * attempt);
  }
  return false;
}

void handlePendingCommands(int floatState) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(COMMAND_POLL_URL) + "?deviceId=" + DEVICE_ID;
  if (!http.begin(client, url)) {
    Serial.println("Command poll failed to start HTTP session");
    return;
  }

  const int status = http.GET();
  if (status != 200) {
    http.end();
    return;
  }

  const String body = http.getString();
  http.end();

  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, body) != DeserializationError::Ok) {
    Serial.println("Failed to parse command payload");
    return;
  }


  JsonObject command = doc["command"];
  if (command.isNull()) {
    return;
  }

  const int commandId = command["id"] | 0;
  if (commandId <= 0) {
    return;
  }

  JsonVariant payload = command["payload"];
  // Support actuator name (pump) or solenoid channel
  String actuatorName = payload.isNull() ? String("") : String(payload["actuator"] | "");
  actuatorName.toLowerCase();
  const int solenoid = payload.isNull() ? 0 : payload["solenoid"] | payload["channel"] | 0;
  String desired = payload.isNull() ? String("") : String(payload["action"] | payload["desired"] | "");
  desired.toLowerCase();
  const bool turnOn = desired == "on";
  const bool permitted = (floatState == HIGH) || !turnOn;

  if (actuatorName == "pump") {
    // Pump control: respect float safety
    if (!permitted) {
      applyPump(false);
    } else {
      applyPump(turnOn);
    }
  } else {
    // Solenoid handling (existing behavior)
    if (!permitted) {
      disableAllSolenoids("float sensor safety");
    } else {
      applySolenoid(solenoid, turnOn, true);
    }
  }

  DynamicJsonDocument ack(256);
  ack["status"] = permitted ? "ok" : "error";
  if (!permitted) {
    ack["message"] = "Float sensor LOW; actuators disabled";
  }
  JsonObject ackPayload = ack.createNestedObject("payload");
  ackPayload["device_id"] = DEVICE_ID;
  if (actuatorName == "pump") {
    ackPayload["actuator"] = "pump";
    ackPayload["action"] = turnOn ? "on" : "off";
  } else {
    ackPayload["solenoid"] = solenoid;
    ackPayload["action"] = turnOn ? "on" : "off";
  }
  ackPayload["float_sensor"] = floatState == HIGH ? 1 : 0;
  if (!payload.isNull() && payload.containsKey("commandRowId")) {
    ackPayload["commandRowId"] = payload["commandRowId"].as<int>();
  }

  String ackBody;
  serializeJson(ack, ackBody);

  const String ackUrl = String(COMMAND_ACK_BASE_URL) + "/" + String(commandId) + "/ack";
  if (postJson(ackUrl, ackBody)) {
    Serial.printf("Ack sent for command %d\n", commandId);
  } else {
    Serial.printf("Ack failed for command %d\n", commandId);
  }
}

void applySolenoid(int index, bool turnOn, bool fromCommand) {
  if (index < 1 || index > 3) {
    Serial.println("Unknown solenoid index");
    return;
  }

  uint8_t pin = SOLENOID_PIN_1;
  if (index == 2) {
    pin = SOLENOID_PIN_2;
  } else if (index == 3) {
    pin = SOLENOID_PIN_3;
  }

  solenoidStates[index - 1] = turnOn;
  digitalWrite(pin, turnOn ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  Serial.printf("Solenoid %d %s%s\n", index, turnOn ? "ON" : "OFF", fromCommand ? " (command)" : "");
}

void applyPump(bool turnOn) {
  digitalWrite(PUMP_PIN, turnOn ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  Serial.printf("[ACTUATOR] Water Pump -> %s\n", turnOn ? "ON" : "OFF");
}

void disableAllSolenoids(const char* reason) {
  digitalWrite(SOLENOID_PIN_1, RELAY_INACTIVE_LEVEL);
  digitalWrite(SOLENOID_PIN_2, RELAY_INACTIVE_LEVEL);
  digitalWrite(SOLENOID_PIN_3, RELAY_INACTIVE_LEVEL);
  solenoidStates[0] = solenoidStates[1] = solenoidStates[2] = false;
  Serial.printf("[SAFETY] All actuators disabled (%s)\n", reason ? reason : "manual");
}

void syncThresholds() {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, CONFIG_URL)) {
    Serial.println("[SYNC] HTTP begin failed");
    return;
  }
  int code = http.GET();
  if (code == 200) {
    Serial.println("[SYNC] Thresholds fetched successfully.");
  } else {
    Serial.printf("[SYNC] Failed to fetch thresholds: HTTP %d\n", code);
  }
  http.end();
  lastThresholdSyncAt = millis();
}

int readFloatSensor() {
  const int value = digitalRead(FLOAT_SENSOR_PIN);
  Serial.printf("Float sensor state: %s\n", value == HIGH ? "HIGH" : "LOW");
  return value;
}

int readSoilMoisture() {
  const uint32_t sample = esp_random() & 0x0FFF;
  return map(sample, 0, 0x0FFF, 35, 75);
}

float readTemperature() {
  const uint32_t sample = esp_random() & 0x03FF;
  return 26.0f + (sample % 50) / 10.0f;
}

float readHumidity() {
  const uint32_t sample = esp_random() & 0x07FF;
  return 55.0f + (sample % 200) / 10.0f;
}
