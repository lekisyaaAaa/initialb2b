/*
    ESP32A – Actuator Controller (Pump + 3 Solenoids + Float Sensor)
    Designed for VermiLinks (2025)
    ---------------------------------------------------------------
    Features:
      ✓ Controls pump + 3 solenoid valves
      ✓ Reads float sensor (HIGH = safe / WET, LOW = DRY / reservoir low)
      ✓ Auto-shuts off all actuators if reservoir is LOW
      ✓ Publishes retained MQTT state to Home Assistant
      ✓ Publishes availability (online/offline)
      ✓ Accepts MQTT commands for pump & valves
      ✓ Re-publishes last state after reconnect
      ✓ Sends webhook snapshots to your backend
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>

// ---------------- WIFI SETTINGS ----------------
const char* WIFI_SSID = "Knights_IOT";
const char* WIFI_PASS = "smbcr-5540";

// ---------------- MQTT SETTINGS ----------------
const char* MQTT_HOST = "192.168.8.142";
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "knights_iot";
const char* MQTT_PASS = "smbcr-5540";

const char* TOPIC_STATE   = "vermilinks/esp32a/state";
const char* TOPIC_STATUS  = "vermilinks/esp32a/status";
const char* TOPIC_PUMP    = "vermilinks/esp32a/pump";
const char* TOPIC_VALVE_1 = "vermilinks/esp32a/valve1";
const char* TOPIC_VALVE_2 = "vermilinks/esp32a/valve2";
const char* TOPIC_VALVE_3 = "vermilinks/esp32a/valve3";

// ---------------- WEBHOOK SETTINGS ----------------
const char* DEVICE_ID      = "esp32a-actuators";
const char* WEBHOOK_URL    = "https://vermilinks-backend.onrender.com/api/ha/webhook";
const char* WEBHOOK_SECRET = "VermiLinks_HA_Webhook_2025!";

// ---------------- PIN MAP ----------------
#define FLOAT_SENSOR_PIN 16   // HIGH = WET (safe), LOW = DRY
#define PUMP_PIN         5
#define SOL1_PIN         25
#define SOL2_PIN         26
#define SOL3_PIN         27

const int RELAY_ACTIVE   = LOW;
const int RELAY_INACTIVE = HIGH;

// ---------------- GLOBAL STATE ----------------
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

bool pumpState = false;
bool valveState[3] = { false, false, false };
bool lastFloatSafe = true;

unsigned long lastSnapshot = 0;
const unsigned long SNAPSHOT_INTERVAL_MS = 5000;

String lastJson = "{}";
bool haveLastJson = false;

// ---------------- HELPERS ----------------
const char* toLiteral(bool x) { return x ? "true" : "false"; }

void setRelay(int pin, bool on) {
  digitalWrite(pin, on ? RELAY_ACTIVE : RELAY_INACTIVE);
}

bool floatSensorSafe() {
  return digitalRead(FLOAT_SENSOR_PIN) == HIGH;
}

// ---------------- WIFI ----------------
void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WiFi] Connecting...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WiFi] FAILED. Will retry.");
  }
}

// ---------------- WEBHOOK SEND ----------------
bool sendWebhook(const char* json) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  if (!http.begin(client, WEBHOOK_URL)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + WEBHOOK_SECRET);

  int code = http.POST(json);
  Serial.printf("[Webhook] Status: %d\n", code);

  http.end();

  return code >= 200 && code < 300;
}

// ---------------- STATE PUBLISH ----------------
void publishState(const char* reason) {
  if (WiFi.status() != WL_CONNECTED) return;

  bool floatSafe = floatSensorSafe();
  int rssi = WiFi.RSSI();

  char json[512];
  snprintf(
    json, sizeof(json),
    "{"
      "\"deviceId\":\"%s\"," 
      "\"floatSensor\":%d,"
      "\"floatSensorLabel\":\"%s\","
      "\"signalStrength\":%d,"
      "\"pump\":%s,"
      "\"valve1\":%s,"
      "\"valve2\":%s,"
      "\"valve3\":%s,"
      "\"reason\":\"%s\""
    "}",
    DEVICE_ID,
    floatSafe ? 1 : 0,
    floatSafe ? "WET" : "DRY",
    rssi,
    toLiteral(pumpState),
    toLiteral(valveState[0]),
    toLiteral(valveState[1]),
    toLiteral(valveState[2]),
    reason
  );

  lastJson = json;
  haveLastJson = true;

  bool ok = mqtt.publish(TOPIC_STATE, json, true);  // RETAINED
  Serial.printf("[MQTT] State published (%s)\n", ok ? "OK" : "FAIL");

  sendWebhook(json);
}

// ---------------- EMERGENCY STOP ----------------
void stopAllActuators(const char* reason) {
  bool changed = false;

  if (pumpState) { pumpState = false; setRelay(PUMP_PIN, false); changed = true; }
  if (valveState[0]) { valveState[0] = false; setRelay(SOL1_PIN, false); changed = true; }
  if (valveState[1]) { valveState[1] = false; setRelay(SOL2_PIN, false); changed = true; }
  if (valveState[2]) { valveState[2] = false; setRelay(SOL3_PIN, false); changed = true; }

  if (changed) {
    Serial.printf("[SAFE MODE] Actuators OFF (%s)\n", reason);
    publishState(reason);
  }
}

// ---------------- MQTT ----------------
void mqttCallback(char* topic, byte* payload, unsigned int len) {
  String data;
  for (uint i = 0; i < len; i++) data += (char)payload[i];

  data.trim();
  data.toUpperCase();
  bool cmdOn = (data == "ON" || data == "1" || data == "TRUE");

  bool safe = floatSensorSafe();
  if (!safe && cmdOn) {
    Serial.println("[BLOCKED] Reservoir LOW - ignoring ON command");
    stopAllActuators("float-low");
    return;
  }

  if (strcmp(topic, TOPIC_PUMP) == 0) {
    pumpState = cmdOn;
    setRelay(PUMP_PIN, cmdOn);
  }
  else if (strcmp(topic, TOPIC_VALVE_1) == 0) {
    valveState[0] = cmdOn;
    setRelay(SOL1_PIN, cmdOn);
  }
  else if (strcmp(topic, TOPIC_VALVE_2) == 0) {
    valveState[1] = cmdOn;
    setRelay(SOL2_PIN, cmdOn);
  }
  else if (strcmp(topic, TOPIC_VALVE_3) == 0) {
    valveState[2] = cmdOn;
    setRelay(SOL3_PIN, cmdOn);
  }

  publishState("command");
}

void ensureMqtt() {
  if (mqtt.connected()) return;

  Serial.print("[MQTT] Connecting... ");

  if (mqtt.connect("ESP32A_Client", MQTT_USER, MQTT_PASS, TOPIC_STATUS, 1, true, "offline")) {
    Serial.println("OK");
    mqtt.publish(TOPIC_STATUS, "online", true);

    mqtt.subscribe(TOPIC_PUMP, 1);
    mqtt.subscribe(TOPIC_VALVE_1, 1);
    mqtt.subscribe(TOPIC_VALVE_2, 1);
    mqtt.subscribe(TOPIC_VALVE_3, 1);

    if (haveLastJson) {
      mqtt.publish(TOPIC_STATE, lastJson.c_str(), true);
    }
  }
  else {
    Serial.printf("FAILED (%d)\n", mqtt.state());
  }
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  Serial.println("\n--- ESP32A Booting ---");

  pinMode(FLOAT_SENSOR_PIN, INPUT_PULLUP);
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(SOL1_PIN, OUTPUT);
  pinMode(SOL2_PIN, OUTPUT);
  pinMode(SOL3_PIN, OUTPUT);

  setRelay(PUMP_PIN, false);
  setRelay(SOL1_PIN, false);
  setRelay(SOL2_PIN, false);
  setRelay(SOL3_PIN, false);

  WiFi.mode(WIFI_STA);
  ensureWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
}

// ---------------- MAIN LOOP ----------------
void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  bool floatSafe = floatSensorSafe();
  if (floatSafe != lastFloatSafe) {
    lastFloatSafe = floatSafe;
    if (!floatSafe) stopAllActuators("float-trigger");
    publishState("float-change");
  }

  if (millis() - lastSnapshot >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshot = millis();
    publishState("periodic");
  }

  delay(20);
}
