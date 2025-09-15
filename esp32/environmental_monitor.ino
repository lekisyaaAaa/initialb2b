#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>
#include <ModbusMaster.h>
#include <Wire.h>
#include <SPIFFS.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend API endpoint
const char* serverUrl = "http://YOUR_BACKEND_IP:3000/api/sensors";

// RS485/MODBUS configuration for soil sensor
#define RS485_RX 16  // GPIO16
#define RS485_TX 17  // GPIO17
#define RS485_DE 18  // GPIO18 (DE/RE pin)
SoftwareSerial rs485Serial(RS485_RX, RS485_TX);
ModbusMaster node;

// NPK sensor I2C address
#define NPK_SENSOR_ADDR 0x58

// Water level float sensor pin
#define WATER_LEVEL_PIN 19  // GPIO19

// Relay control pins for actuators
#define PUMP_RELAY_PIN 21    // GPIO21
#define SOLENOID_RELAY_PIN 22 // GPIO22

// Timing
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 30000; // 30 seconds

// Device ID
const char* deviceId = "ESP32_001";

// Sensor data structure
struct SensorData {
  float temperature;
  float humidity;
  float moisture;
  float ph;
  float ec;
  float nitrogen;
  float phosphorus;
  float potassium;
  int waterLevel;
  float batteryLevel;
  int signalStrength;
};

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize SPIFFS for offline storage
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS Mount Failed");
    return;
  }

  // Initialize RS485
  pinMode(RS485_DE, OUTPUT);
  digitalWrite(RS485_DE, LOW);
  rs485Serial.begin(9600);
  node.begin(1, rs485Serial); // Slave ID 1

  // Initialize I2C for NPK sensor
  Wire.begin();

  // Initialize water level sensor
  pinMode(WATER_LEVEL_PIN, INPUT_PULLUP);

  // Initialize relay pins
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(SOLENOID_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, HIGH); // Relay OFF (assuming active LOW)
  digitalWrite(SOLENOID_RELAY_PIN, HIGH);

  // Connect to WiFi
  connectToWiFi();

  Serial.println("ESP32 Environmental Monitor initialized");
}

void loop() {
  // Read sensors
  SensorData data = readSensors();

  // Control actuators based on conditions
  controlActuators(data);

  // Send data to backend
  if (millis() - lastSendTime >= sendInterval) {
    sendSensorData(data);
    lastSendTime = millis();
  }

  delay(1000);
}

SensorData readSensors() {
  SensorData data = {0};

  // Read RS485 soil sensor (temperature, humidity, moisture, pH, EC)
  data = readSoilSensor();

  // Read NPK sensor
  readNPKSensor(data);

  // Read water level sensor
  data.waterLevel = digitalRead(WATER_LEVEL_PIN);

  // Read battery level (if available)
  data.batteryLevel = readBatteryLevel();

  // Read WiFi signal strength
  data.signalStrength = WiFi.RSSI();

  return data;
}

SensorData readSoilSensor() {
  SensorData data = {0};

  // Pre-transmission: Enable RS485 transmission
  digitalWrite(RS485_DE, HIGH);
  delay(10);

  // Read temperature (register 0x0001)
  uint8_t result = node.readHoldingRegisters(0x0001, 1);
  if (result == node.ku8MBSuccess) {
    data.temperature = node.getResponseBuffer(0) / 10.0;
  }

  // Read humidity (register 0x0002)
  result = node.readHoldingRegisters(0x0002, 1);
  if (result == node.ku8MBSuccess) {
    data.humidity = node.getResponseBuffer(0) / 10.0;
  }

  // Read moisture (register 0x0003)
  result = node.readHoldingRegisters(0x0003, 1);
  if (result == node.ku8MBSuccess) {
    data.moisture = node.getResponseBuffer(0) / 10.0;
  }

  // Read pH (register 0x0004)
  result = node.readHoldingRegisters(0x0004, 1);
  if (result == node.ku8MBSuccess) {
    data.ph = node.getResponseBuffer(0) / 10.0;
  }

  // Read EC (register 0x0005)
  result = node.readHoldingRegisters(0x0005, 1);
  if (result == node.ku8MBSuccess) {
    data.ec = node.getResponseBuffer(0) / 10.0;
  }

  // Post-transmission: Disable RS485 transmission
  digitalWrite(RS485_DE, LOW);

  return data;
}

void readNPKSensor(SensorData& data) {
  Wire.beginTransmission(NPK_SENSOR_ADDR);
  Wire.write(0x03); // Read command
  Wire.write(0x00); // Start register
  Wire.write(0x03); // Number of registers
  Wire.endTransmission();

  delay(100);

  Wire.requestFrom(NPK_SENSOR_ADDR, 6);
  if (Wire.available() >= 6) {
    uint16_t nitrogen = Wire.read() << 8 | Wire.read();
    uint16_t phosphorus = Wire.read() << 8 | Wire.read();
    uint16_t potassium = Wire.read() << 8 | Wire.read();

    data.nitrogen = nitrogen / 10.0;
    data.phosphorus = phosphorus / 10.0;
    data.potassium = potassium / 10.0;
  }
}

float readBatteryLevel() {
  // Implement battery reading if you have a battery sensor
  // For now, return a dummy value
  return 3.7;
}

void controlActuators(const SensorData& data) {
  static unsigned long lastPumpChange = 0;
  static unsigned long lastSolenoidChange = 0;
  const unsigned long minChangeInterval = 5000; // 5 seconds minimum between changes

  // Pump control: Turn on if moisture is low and water level is sufficient
  // Safety: Only change if enough time has passed since last change
  if (millis() - lastPumpChange > minChangeInterval) {
    if (data.moisture < 20.0 && data.waterLevel == HIGH) {
      digitalWrite(PUMP_RELAY_PIN, LOW); // Turn on pump (assuming active LOW)
      Serial.println("Pump ON - Moisture low and water available");
      lastPumpChange = millis();
    } else if (data.moisture > 30.0 || data.waterLevel == LOW) {
      digitalWrite(PUMP_RELAY_PIN, HIGH); // Turn off pump
      Serial.println("Pump OFF - Moisture sufficient or no water");
      lastPumpChange = millis();
    }
  }

  // Solenoid control: Turn on if pH is out of range
  // Safety: Only change if enough time has passed since last change
  if (millis() - lastSolenoidChange > minChangeInterval) {
    if (data.ph < 6.0 || data.ph > 7.5) {
      digitalWrite(SOLENOID_RELAY_PIN, LOW); // Turn on solenoid
      Serial.println("Solenoid ON - pH out of range");
      lastSolenoidChange = millis();
    } else if (data.ph >= 6.0 && data.ph <= 7.5) {
      digitalWrite(SOLENOID_RELAY_PIN, HIGH); // Turn off solenoid
      Serial.println("Solenoid OFF - pH in range");
      lastSolenoidChange = millis();
    }
  }
}

void sendSensorData(const SensorData& data) {
  if (WiFi.status() != WL_CONNECTED) {
    // Store offline data
    storeOfflineData(data);
    return;
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");

  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["deviceId"] = deviceId;
  doc["temperature"] = data.temperature;
  doc["humidity"] = data.humidity;
  doc["moisture"] = data.moisture;
  doc["ph"] = data.ph;
  doc["ec"] = data.ec;
  doc["nitrogen"] = data.nitrogen;
  doc["phosphorus"] = data.phosphorus;
  doc["potassium"] = data.potassium;
  doc["waterLevel"] = data.waterLevel;
  doc["batteryLevel"] = data.batteryLevel;
  doc["signalStrength"] = data.signalStrength;

  String jsonString;
  serializeJson(doc, jsonString);

  Serial.println("Sending data: " + jsonString);

  int httpResponseCode = http.POST(jsonString);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    Serial.println("Response: " + response);
  } else {
    Serial.println("Error in HTTP request");
    // Store offline data
    storeOfflineData(data);
  }

  http.end();
}

void storeOfflineData(const SensorData& data) {
  // Store data in SPIFFS for later sync
  File file = SPIFFS.open("/offline_data.jsonl", "a");
  if (!file) {
    Serial.println("Failed to open file for writing");
    return;
  }

  DynamicJsonDocument doc(1024);
  doc["timestamp"] = millis();
  doc["deviceId"] = deviceId;
  doc["temperature"] = data.temperature;
  doc["humidity"] = data.humidity;
  doc["moisture"] = data.moisture;
  doc["ph"] = data.ph;
  doc["ec"] = data.ec;
  doc["nitrogen"] = data.nitrogen;
  doc["phosphorus"] = data.phosphorus;
  doc["potassium"] = data.potassium;
  doc["waterLevel"] = data.waterLevel;
  doc["batteryLevel"] = data.batteryLevel;
  doc["signalStrength"] = data.signalStrength;

  String jsonString;
  serializeJson(doc, jsonString);
  file.println(jsonString);
  file.close();

  Serial.println("Data stored offline");
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.println("IP address: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed");
  }
}
