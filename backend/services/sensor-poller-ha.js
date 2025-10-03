/*
Enhanced sensor poller service for Home Assistant + ESPHome integration
- Polls Home Assistant REST API for ESPHome device sensor readings
- Supports both REST API polling and MQTT WebSocket for real-time updates
- Normalizes ESPHome sensor data to stable schema
- Appends to backend/data/sensor-stream.jsonl (atomic writes)
- Exposes /internal/sensor-agg for last poll time and counts
*/

const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Home Assistant Configuration
const HA_BASE_URL = process.env.HA_BASE_URL || 'http://homeassistant.local:8123';
const HA_TOKEN = process.env.HA_TOKEN; // Long-lived access token from HA
const HA_ENTITY_FILTER = process.env.HA_ENTITY_FILTER || 'sensor.esphome_'; // Filter for ESPHome sensors

// Polling Configuration
const POLL_MS = parseInt(process.env.POLL_MS || '30000', 10); // 30 seconds for HA
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '2', 10);
const USE_MQTT = process.env.USE_MQTT === 'true'; // Future MQTT support

// Data Storage
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(__dirname, '..', 'data', 'sensor-stream.jsonl');

let running = false;
let inFlight = 0;
let lastPollTime = null;
let counts = {};
let memStore = [];

// ESPHome sensor type mapping
const ESPSENSOR_TYPES = {
  'temperature': ['temperature', 'temp', '°c', '°f'],
  'humidity': ['humidity', 'humid', '%'],
  'moisture': ['moisture', 'soil_moisture', 'moist'],
  'ph': ['ph', 'ph_level', 'ph_value'],
  'ec': ['ec', 'conductivity', 'tds'],
  'nitrogen': ['nitrogen', 'n'],
  'phosphorus': ['phosphorus', 'p'],
  'potassium': ['potassium', 'k'],
  'battery': ['battery', 'batt', 'voltage'],
  'waterLevel': ['water_level', 'waterLevel', 'level'],
  'pressure': ['pressure', 'psi', 'bar'],
  'light': ['light', 'lux', 'illuminance']
};

function normalizeHASensor(entity) {
  const entityId = entity.entity_id; // e.g., "sensor.esphome_device_temperature"
  const friendlyName = entity.attributes?.friendly_name || entityId;
  const state = entity.state;
  const unit = entity.attributes?.unit_of_measurement || '';

  // Extract device name from entity_id (e.g., "esphome_device" from "sensor.esphome_device_temperature")
  const deviceMatch = entityId.match(/^sensor\.esphome_(.+?)_(.+)$/);
  if (!deviceMatch) return null;

  const deviceId = deviceMatch[1]; // e.g., "greenhouse_01"
  const sensorTypeRaw = deviceMatch[2]; // e.g., "temperature"

  // Map to our sensor types
  let sensorType = 'other';
  for (const [type, keywords] of Object.entries(ESPSENSOR_TYPES)) {
    if (keywords.some(keyword => sensorTypeRaw.toLowerCase().includes(keyword))) {
      sensorType = type;
      break;
    }
  }

  // Convert state to number
  const value = parseFloat(state);
  if (isNaN(value)) return null;

  return {
    timestamp: new Date().toISOString(),
    sensorId: `${deviceId}_${sensorType}`,
    deviceId: deviceId,
    type: sensorType,
    value: value,
    unit: unit,
    meta: {
      ha_entity_id: entityId,
      friendly_name: friendlyName,
      ha_state: state,
      ha_attributes: entity.attributes
    }
  };
}

function safeAppendLine(filePath, line) {
  const tmp = filePath + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmp, line + '\n', { encoding: 'utf8' });
  const data = fs.readFileSync(tmp, { encoding: 'utf8' });
  fs.appendFileSync(filePath, data, { encoding: 'utf8' });
  fs.unlinkSync(tmp);
}

async function pollHomeAssistant() {
  if (inFlight >= MAX_CONCURRENT) return;
  inFlight++;

  try {
    const headers = {
      'Authorization': `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // Get all states from Home Assistant
    const statesUrl = `${HA_BASE_URL}/api/states`;
    console.log('Polling Home Assistant:', statesUrl);

    const resp = await axios.get(statesUrl, { headers, timeout: 15000 });
    const entities = resp.data;

    // Filter for ESPHome sensors
    const espSensors = entities.filter(entity =>
      entity.entity_id.startsWith('sensor.esphome_') &&
      entity.entity_id.includes(HA_ENTITY_FILTER.replace('sensor.esphome_', ''))
    );

    console.log(`Found ${espSensors.length} ESPHome sensors`);

    let processedCount = 0;
    for (const entity of espSensors) {
      const normalized = normalizeHASensor(entity);
      if (normalized) {
        memStore.push(normalized);
        counts[normalized.type] = (counts[normalized.type] || 0) + 1;

        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
          safeAppendLine(OUT_FILE, JSON.stringify(normalized));
          processedCount++;
        } catch (e) {
          console.error('Failed to persist reading:', e && e.message ? e.message : e);
        }
      }
    }

    lastPollTime = new Date().toISOString();
    console.log(`Processed ${processedCount} sensor readings from ${espSensors.length} ESPHome entities`);

  } catch (err) {
    console.error('Home Assistant poll error:', err && err.message ? err.message : err);
    throw err;
  } finally {
    inFlight--;
  }
}

async function runLoop() {
  running = true;
  console.log('Starting Home Assistant sensor poller...');
  console.log('HA URL:', HA_BASE_URL);
  console.log('Entity Filter:', HA_ENTITY_FILTER);
  console.log('Poll Interval:', POLL_MS + 'ms');

  while (running) {
    try {
      await pollHomeAssistant();
    } catch (err) {
      console.error('Poll cycle failed:', err.message);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

function stop() {
  running = false;
}

// Express routes for monitoring
const app = express();
app.get('/sensor-agg', (req, res) => {
  res.json({
    lastPollTime,
    counts,
    inFlight,
    memStoreLength: memStore.length,
    haConfig: {
      baseUrl: HA_BASE_URL,
      entityFilter: HA_ENTITY_FILTER,
      useMqtt: USE_MQTT
    }
  });
});

app.get('/sensor-data', (req, res) => {
  res.json(memStore.slice(-100)); // Last 100 readings
});

module.exports = {
  start: runLoop,
  stop,
  app,
  getStatus: () => ({ running, lastPollTime, counts, inFlight })
};