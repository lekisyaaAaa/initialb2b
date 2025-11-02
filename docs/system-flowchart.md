# System Flow Overview

The diagram below summarizes the major runtimes, data flows, and orchestration scripts for the BeanToBin monitoring platform.

```mermaid
flowchart TD
    subgraph Client
        A[Admin / Operator
Web Browser]
    end

    subgraph PM2[PM2 start-all.ps1]
        B[Frontend SPA
React + Vite
btb-frontend @3002]
        C[Backend API
Express + Socket.IO
btb-backend @5000]
        D[WS Simulator
Smoke actuator
btb-ws-sim-smoke]
        E[WS Simulator
ESP32 telemetry
btb-ws-sim-esp32]
    end

    subgraph Data[Persistent Storage]
        F[(PostgreSQL 15
Docker container
system-db-1 @5075)]
    end

    subgraph Aux[Supporting Jobs]
        G[Sensor Poller
RUN_POLLER=true]
        H[Seeding Scripts
sync_models.js
seed-admin.js]
    end

    subgraph Devices[Physical / Virtual Devices]
        I[ESP32 Hardware]
        J[Field Sensors
(temperature, humidity,
moisture)]
    end

    subgraph External[Automation / Tooling]
        K[docker-compose up db]
    end

    A -->|HTTPS 3002| B
    B -->|REST /api/*| C
    B <-->|Socket.IO events| C

    C -->|Sequelize ORM
read/write| F
    H -->|Schema sync + admin seed| F
    H -->|Invoked manually
pre-start| C

    C <-->|Raw WebSocket JSON| D
    C <-->|Raw WebSocket JSON| E
    E -->|Simulated telemetry| C
    D <--|Actuator commands| C

    C <-->|WebSocket commands| I
    I -->|Sensor payload| C
    I --> J

    G -->|Internal HTTP + services| C

    K -->|Launch container| F

    PM2 -. supervises .-> C
    PM2 -. supervises .-> B
    PM2 -. supervises .-> D
    PM2 -. supervises .-> E
```

## Notes
- `start-all.ps1` wraps PM2 to launch the backend, frontend, and both simulator processes.
- PostgreSQL runs inside Docker (`docker-compose up db`); all Sequelize connections use port `5075`.
- Telemetry sources (real ESP32 hardware or the PM2 simulators) push JSON via raw WebSockets; actuator commands flow back over the same socket.
- The optional sensor poller (`RUN_POLLER=true`) runs inside the backend process to ingest data from external services.
- Ensure simulators stay disabled in production deployments unless needed for demos.