# Home Assistant Snapshot Push

Home Assistant is now the primary source of telemetry for VermiLinks. Instead of maintaining a WebSocket bridge or talking to the ESP32 directly, the backend exposes a REST endpoint (`POST /api/sensors/ingest-ha`) that accepts the latest readings and immediately updates the dashboard cache.

## Backend environment checklist

Configure these variables in `backend/.env` (or the Render dashboard):

- `ENABLE_HOME_ASSISTANT_BRIDGE=false`
- `ALLOW_HOME_ASSISTANT_PUSH_WITHOUT_SOCKET=true`
- `HOME_ASSISTANT_DEVICE_ID=vermilinks-homeassistant` *(optional override for the device id attached to snapshots)*
- Leave `HOME_ASSISTANT_BASE_URL`, `HOME_ASSISTANT_TOKEN`, and related mapping settings blank unless you plan to re-enable the WebSocket bridge later.

For the frontend “Open Home Assistant” button, set `REACT_APP_HOME_ASSISTANT_URL` (or `VITE_HOME_ASSISTANT_URL`) in `frontend/.env` to the URL your operators should visit.

## Snapshot payload contract

Send JSON with any subset of these fields:

```
{
	"temperature": 24.2,
	"humidity": 62.3,
	"soil_moisture": 44.1,
	"float_state": 0,
	"timestamp": "2025-11-14T15:04:05Z",
	"source": "home_assistant"
}
```

- Values are coerced to numbers server-side; omit keys you do not track.
- `soil_moisture` and `moisture` are treated identically—the backend keeps whichever you provide.
- `float_state`/`float` expects `0` or `1`. Use Jinja’s `|int` filter to convert `on/off`.
- `timestamp` is optional; the server falls back to the current time.
- Duplicate payloads (within ±1 s) are ignored so repeated automations do not spam the database.

## Home Assistant YAML

1. Define the REST command (use a secret for the URL if exposing over the internet):

```
rest_command:
	vermilinks_push_snapshot:
		url: !secret vermilinks_ingest_url
		method: POST
		content_type: "application/json"
		timeout: 10
		payload: >
			{
				"temperature": {{ temperature }},
				"humidity": {{ humidity }},
				"soil_moisture": {{ soil_moisture }},
				"float_state": {{ float_state }},
				"timestamp": "{{ timestamp }}",
				"source": "home_assistant"
			}
```

2. Create an automation that fires whenever any tracked entity changes:

```
automation:
	- id: vermilinks_push_snapshot
		alias: VermiLinks • Push Snapshot
		mode: queued
		trigger:
			- platform: state
				entity_id:
					- sensor.vermi_temperature
					- sensor.vermi_humidity
					- sensor.vermi_moisture
					- binary_sensor.vermi_reservoir_low
		action:
			- service: rest_command.vermilinks_push_snapshot
				data:
					temperature: "{{ states('sensor.vermi_temperature') | float(0) }}"
					humidity: "{{ states('sensor.vermi_humidity') | float(0) }}"
					moisture: "{{ states('sensor.vermi_moisture') | float(0) }}"
					float_state: "{{ is_state('binary_sensor.vermi_reservoir_low', 'on') | int }}"
					timestamp: "{{ now().isoformat() }}"
```

Adjust the `entity_id` entries to match your sensors. You can run the automation manually from Developer Tools → Automations → *Run* to test.

## Validation steps

1. Redeploy or restart the backend after updating environment variables.
2. Trigger the automation (e.g., via Developer Tools → Services → `rest_command.vermilinks_push_snapshot` with test data).
3. Check the backend logs for `ingest-ha` messages.
4. Call `GET /api/sensors/latest` and confirm the snapshot:

```
curl http://localhost:5000/api/sensors/latest | ConvertFrom-Json | Format-List
```

5. Open the VermiLinks dashboard. The Sensor Summary panel refreshes within the polling interval (default 5 s) and the “Open Home Assistant” button links to the URL you configured.

## Optional WebSocket bridge

If you later need continuous streaming from Home Assistant, you can set `ENABLE_HOME_ASSISTANT_BRIDGE=true` and supply the original token plus mapping variables. The REST automation above continues to work; the bridge simply supplements it with real-time events.