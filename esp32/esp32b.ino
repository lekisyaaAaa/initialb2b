/*
  ESP32B - RS485 (Modbus RTU) -> MQTT publisher
  - Polls your five-pin soil multi-parameter sensor (default addr 0x01)
  - Default baud: 4800, 8N1 (per datasheet)
  - Publishes retained JSON to vermilinks/esp32b/metrics
  - Publishes availability to vermilinks/esp32b/status
  - Keeps polling even if WiFi/MQTT temporarily drops; publishes last payload on reconnect

  Update WIFI_SSID / WIFI_PASS / MQTT_HOST / MQTT_USER / MQTT_PASS as needed.
*/

#include <WiFi.h>
#include <PubSubClient.h>

// ------------- CONFIG -------------
const char* WIFI_SSID = "Knights_IOT";
const char* WIFI_PASS = "smbcr-5540";

const char* MQTT_HOST = "192.168.8.142";
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "knights_iot";
const char* MQTT_PASS = "smbcr-5540";

const char* TOPIC_METRICS = "vermilinks/esp32b/metrics";
const char* TOPIC_STATUS  = "vermilinks/esp32b/status";

const unsigned long POLL_INTERVAL_MS = 5000UL; // poll every 5s (matches device examples)

// RS485 UART pins (adjust if you wired differently)
#define RS485_RX 17
#define RS485_TX 18
#define RS485_DIR 4     // HIGH -> transmit, LOW -> receive

HardwareSerial Rs485Serial(2); // UART2 = Serial2

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPoll = 0;
String lastPayload = "{}";
bool havePayload = false;

// Pre-built Modbus request: addr=0x01 fc=0x03 start=0x0000 qty=0x0007 + CRC (calculated below)
uint8_t modbusRequest[8] = { 0x01, 0x03, 0x00, 0x00, 0x00, 0x07, 0x00, 0x00 };

// ---------------- CRC16 (Modbus) ----------------
uint16_t modbusCRC16(const uint8_t *buf, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t pos = 0; pos < len; pos++) {
    crc ^= (uint16_t)buf[pos];
    for (int i = 0; i < 8; i++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0xA001;
      else crc = crc >> 1;
    }
  }
  return crc;
}

// ----------------- Helpers -----------------
void set485Dir(bool tx) {
  digitalWrite(RS485_DIR, tx ? HIGH : LOW);
  // small delay for driver to settle
  delayMicroseconds(50);
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
    if (millis() - start > 20000) break; // avoid infinite block
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connected.");
  } else {
    Serial.println(" failed.");
  }
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  Serial.print("Connecting MQTT...");
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  unsigned long start = millis();
  while (!mqtt.connected()) {
    String clientId = "ESP32B_Client_" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, TOPIC_STATUS, 1, true, "offline")) {
      Serial.println("OK");
      mqtt.publish(TOPIC_STATUS, "online", true);
      // publish last payload if we had one (ensures HA gets last-known values)
      if (havePayload) {
        mqtt.publish(TOPIC_METRICS, lastPayload.c_str(), true);
        Serial.println("Published last payload on reconnect.");
      }
      break;
    } else {
      Serial.printf(" failed rc=%d\n", mqtt.state());
      if (millis() - start > 15000) {
        // give up for now; we'll try again on next loop
        break;
      }
      delay(1000);
    }
  }
}

// ----------------- Poll & parse -----------------
bool pollSensorAndParse(char *outJson, size_t outSize) {
  // build & append CRC to request
  uint8_t req[8];
  memcpy(req, modbusRequest, 8);
  uint16_t crc = modbusCRC16(req, 6); // CRC computed over first 6 bytes (addr..qty)
  req[6] = crc & 0xFF;       // low
  req[7] = (crc >> 8) & 0xFF;// high

  // clear rx buffer
  while (Rs485Serial.available()) Rs485Serial.read();

  // send request: set DE high, TX, then DE low
  set485Dir(true);
  Rs485Serial.write(req, sizeof(req));
  Rs485Serial.flush();
  delayMicroseconds(100);
  set485Dir(false);

  // wait for response (19 bytes expected: addr(1) fn(1) bytecount(1) 14 data bytes + 2 CRC = 19)
  unsigned long start = millis();
  const int expectedLen = 19;
  uint8_t resp[expectedLen];
  int idx = 0;
  while ((millis() - start) < 1000 && idx < expectedLen) {
    if (Rs485Serial.available()) {
      int b = Rs485Serial.read();
      if (b >= 0) {
        resp[idx++] = (uint8_t)b;
      }
    }
  }
  if (idx < 5) { // too short to be valid
    Serial.println("No/short response from sensor");
    return false;
  }
  // verify CRC
  uint16_t respCrc = (uint16_t)resp[idx-2] | ((uint16_t)resp[idx-1] << 8);
  uint16_t calcCrc = modbusCRC16(resp, idx-2);
  if (respCrc != calcCrc) {
    Serial.printf("CRC mismatch (got 0x%04X calc 0x%04X) idx=%d\n", respCrc, calcCrc, idx);
    return false;
  }

  // Basic checks: addr and function
  if (resp[0] != 0x01 || resp[1] != 0x03) {
    Serial.printf("Unexpected resp header: %02X %02X\n", resp[0], resp[1]);
    return false;
  }
  // byte count should be 14 (7 registers * 2)
  int byteCount = resp[2];
  if (byteCount < 14) {
    Serial.printf("Unexpected byte count: %d\n", byteCount);
    return false;
  }

  // parse registers (data starts at resp[3])
  auto u16 = [&](int pos)->uint16_t {
    return (uint16_t)resp[pos] << 8 | (uint16_t)resp[pos+1];
  };

  // According to datasheet example and register map:
  // data[0..1] = moisture (x10) -> e.g. 658 -> 65.8%
  // data[2..3] = temperature (x10) -> e.g. FF9B -> -101 -> -10.1 C
  // data[4..5] = conductivity (uS/cm) (16-bit)
  // data[6..7] = pH (x10)
  // data[8..9] = nitrogen (int)
  // data[10..11] = phosphorus (int)
  // data[12..13] = potassium (int)
  int offset = 3;
  uint16_t rawMoist = u16(offset + 0);       // 2 bytes
  uint16_t rawTemp  = u16(offset + 2);
  uint16_t rawEC    = u16(offset + 4);
  uint16_t rawPH    = u16(offset + 6);
  uint16_t rawN     = u16(offset + 8);
  uint16_t rawP     = u16(offset +10);
  uint16_t rawK     = u16(offset +12);

  // humidity is not provided by this device (per datasheet)
  float moisture = rawMoist / 10.0f;
  // temperature: signed 16-bit
  int16_t tmpSigned = (int16_t)rawTemp;
  float temperature = tmpSigned / 10.0f;
  int ec = (int)rawEC;
  float ph = rawPH / 10.0f;
  int nitrogen = (int)rawN;
  int phosphorus = (int)rawP;
  int potassium = (int)rawK;

  int rssi = WiFi.RSSI();

  // compose JSON into outJson
  // simple snprintf for deterministic output
  int n = snprintf(outJson, outSize,
    "{\"deviceId\":\"esp32b-rs485\",\"temperature\":%.1f,\"moisture\":%.1f,"
    "\"ec\":%d,\"ph\":%.1f,\"nitrogen\":%d,\"phosphorus\":%d,\"potassium\":%d,"
    "\"signalStrength\":%d}",
    temperature, moisture, ec, ph, nitrogen, phosphorus, potassium, rssi);

  Serial.printf("Parsed -> T:%.1f M:%.1f EC:%d pH:%.1f N:%d P:%d K:%d RSSI:%d\n",
                temperature, moisture, ec, ph, nitrogen, phosphorus, potassium, rssi);

  return (n > 0 && (size_t)n < outSize);
}

// ---------------- MQTT callback (not used but required) ----------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // no inbound commands expected on this device; keep minimal
  Serial.printf("MQTT msg %s\n", topic);
}

// ---------------- setup & loop ----------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("ESP32B RS485 -> MQTT starting");

  pinMode(RS485_DIR, OUTPUT);
  digitalWrite(RS485_DIR, LOW); // listen by default

  Rs485Serial.begin(4800, SERIAL_8N1, RS485_RX, RS485_TX);

  WiFi.mode(WIFI_STA);
  ensureWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);

  // prepare modbus request base (addr, fc, start hi/lo, qty hi/lo)
  modbusRequest[0] = 0x01;
  modbusRequest[1] = 0x03;
  modbusRequest[2] = 0x00;
  modbusRequest[3] = 0x00;
  modbusRequest[4] = 0x00;
  modbusRequest[5] = 0x07;
}

void loop() {
  // keep wifi/mqtt alive but don't block on connect forever
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  unsigned long now = millis();
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;

    char payloadBuf[320];
    bool ok = pollSensorAndParse(payloadBuf, sizeof(payloadBuf));
    if (ok) {
      lastPayload = String(payloadBuf);
      havePayload = true;
      // publish if mqtt connected
      if (mqtt.connected()) {
        bool pubOk = mqtt.publish(TOPIC_METRICS, lastPayload.c_str(), true);
        Serial.printf("MQTT publish metrics: %s\n", pubOk ? "OK" : "FAILED");
      } else {
        Serial.println("MQTT not connected: stored payload for later publish");
      }
    } else {
      Serial.println("Sensor poll/parsing failed");
    }
  }

  // If we have payload and MQTT just connected, ensure publish
  if (havePayload && mqtt.connected()) {
    static unsigned long lastEnsurePublish = 0;
    if (millis() - lastEnsurePublish > 10000) {
      mqtt.publish(TOPIC_STATUS, "online", true);
      mqtt.publish(TOPIC_METRICS, lastPayload.c_str(), true);
      lastEnsurePublish = millis();
    }
  }

  delay(10);
}
