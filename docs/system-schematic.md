# VermiLinks System Schematic

```mermaid
flowchart LR
    subgraph Field Devices
        ESP32[ESP32 Sensor Node\n(temp, humidity, moisture, etc.)]
    end

    subgraph Render Cloud
        Backend[Node/Express API\n+ Socket.IO]
        StaticSite[Static Frontend\n(Render Static Site)]
        DB[(Managed PostgreSQL)]
    end

    subgraph Operators
        Browser[Admin Dashboard\n(Web Browser)]
    end

    ESP32 -->|HTTPS POST /api/sensors\nWebSocket events| Backend
    Browser <-->|HTTPS + APIs| StaticSite
    StaticSite -->|REST /api/*\nSocket.IO| Backend
    Backend -->|Sequelize ORM| DB
    Backend -->|Actuator commands\nHTTP POST /command| ESP32
```

- **ESP32 sensor nodes** connect directly to the cloud using Wi-Fi, pushing telemetry to the Render-hosted backend and receiving actuator commands on the same network path.
- The **backend service** exposes REST and WebSocket endpoints and persists readings in Render’s managed PostgreSQL instance.
- The **frontend static site** (also on Render) serves the React dashboard; browsers call the backend for data and subscribe to live updates via Socket.IO.
