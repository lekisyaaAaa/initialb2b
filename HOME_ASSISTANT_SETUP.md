# Direct ESP Snapshot Push (Home Assistant Optional)

The preferred architecture now sends telemetry directly from the ESP32 nodes to the backend webhook. Home Assistant continues to host MQTT entities so you can see readings in Lovelace and issue commands, but it no longer has to repost data every two minutes—no more stale 0.0 values.

## Backend environment checklist

Configure these variables in `backend/.env` (or the Render dashboard):

- `ENABLE_HOME_ASSISTANT_BRIDGE=false`
- `ALLOW_HOME_ASSISTANT_PUSH_WITHOUT_SOCKET=true`
- `HOME_ASSISTANT_DEVICE_ID=vermilinks-homeassistant`
- `HOME_ASSISTANT_WEBHOOK_SECRET=VermiLinks_HA_Webhook_2025!`

## Payload contract (ESP32 → `/api/ha/webhook`)

Send JSON with **top-level fields**. Only include the keys you actually track.

```json
{
	"deviceId": "esp32b-rs485",
	"timestamp": "2025-11-22T03:30:01Z",
	"temperature": 24.2,
	"humidity": 62.3,
	"moisture": 44.1,
	"ph": 6.8,
	"ec": 1280,
	"nitrogen": 420,
	"phosphorus": 110,
	"potassium": 82,
	"signalStrength": -63,
	"waterLevel": 12.4,
	"floatSensor": 1,
	"actuators": {
		"water_pump": false,
		"solenoid_1": true,
		"solenoid_2": false,
		"solenoid_3": false
	}
}
```

Notes:

- Numbers are coerced server-side; omit a metric or send `null` if you do not measure it.
- `floatSensor` accepts `0/1`, booleans, or the strings `"WET"/"DRY"`.
- Duplicate payloads (same `deviceId` + timestamp within ±1 s) are ignored.

## Beginner-friendly ESP32 checklist

1. **Add a webhook helper**
	 ```cpp
	 #include <HTTPClient.h>
	 const char* WEBHOOK_URL = "https://vermilinks-backend.onrender.com/api/ha/webhook";
	 const char* WEBHOOK_SECRET = "VermiLinks_HA_Webhook_2025!";

	 void postSnapshot(const char* body) {
		 WiFiClientSecure client;
		 client.setInsecure();
		 HTTPClient http;
		 if (!http.begin(client, WEBHOOK_URL)) return;
		 http.addHeader("Content-Type", "application/json");
		 http.addHeader("Authorization", String("Bearer ") + WEBHOOK_SECRET);
		 const int status = http.POST(body);
		 if (status < 200 || status >= 300) {
			 Serial.printf("Webhook POST failed: %d %s\n", status, http.getString().c_str());
		 }
		 http.end();
	 }
	 ```
2. **Reuse the same JSON for MQTT + webhook**
	 ```cpp
	 char payload[320];
	 snprintf(payload, sizeof(payload),
						"{\"deviceId\":\"esp32b-rs485\",\"temperature\":%.1f,\"humidity\":%.1f,"
						"\"moisture\":%.1f,\"ph\":%.1f,\"ec\":%d,"
						"\"nitrogen\":%d,\"phosphorus\":%d,\"potassium\":%d,"
						"\"signalStrength\":%d}",
						temperature, humidity, moisture,
						ph, ec,
						nitrogen, phosphorus, potassium,
						WiFi.RSSI());
	 mqtt.publish("vermilinks/esp32b/metrics", payload, false);
	 postSnapshot(payload);
	 ```
3. **ESP32A**: extend `publishSnapshot()` to add an `actuators` object plus `floatSensor`, then call `postSnapshot(payload)` right after `mqtt.publish()`.

## Home Assistant integration (optional but useful)

- Keep the MQTT broker block so Lovelace cards mirror what the ESP publishes.
- Use the reference YAML in `docs/home_assistant_configuration.yaml`—it now matches the flattened JSON, removes the unused battery sensor, and avoids `.state` nesting.
- Disable the old `rest_command` automation so the ESPs remain the single source of truth.

## Validation steps

1. Flash both ESP32A/B with firmware containing the webhook helper.
2. Watch Render logs (`render deploys tail srv-d43v9q0dl3ps73aarv30`) for `HA webhook` entries returning HTTP `201`.
3. Open `https://vermilinks-frontend.onrender.com/` and confirm the Sensor Summary panel updates within ~5 s.
4. Toggle a solenoid from Home Assistant, verify the MQTT state change, and confirm the Admin dashboard actuator badges follow.

## Optional WebSocket bridge

If you later need HA’s WebSocket bridge, set `ENABLE_HOME_ASSISTANT_BRIDGE=true` and restore the original token variables. The ESP webhook flow can stay active; the bridge simply becomes an additional real-time feed.