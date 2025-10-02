Local serving and environment options for the frontend build

This document explains how to serve the production build and configure optional runtime features.

Serving the built frontend

1. Build (already completed in this workspace):
   npm run build

2. Serve the `build/` directory with a static server. From the `frontend/` folder:

   # serve on default port (may prompt to pick another port if in use)
   npx serve -s build

   # OR explicitly bind a port (PowerShell example):
   npx serve -s build -l 3002

Notes
- If port 3002 is already in use, `serve` will pick a free port and print the chosen URL in the console.
- Use Ctrl+C in the terminal to stop the static server.

Optional runtime environment variables

- REACT_APP_ENABLE_WS=true
  When set to `true` the frontend will attempt to connect to a WebSocket for real-time sensor updates.

- REACT_APP_WS_URL
  The WebSocket URL to connect to (for example `ws://localhost:5000` or `wss://example.com/ws`). If not set, the frontend will attempt `ws(s)://<hostname>:5000`.

Troubleshooting

- If charts render as empty, ensure the parent card has a non-zero height (the app sets sensible min-heights by default). Use the browser DevTools to check network and console logs.
- If login fails with a server error, check the backend logs and ensure the backend API is reachable from the frontend.

Contact
- For engineering questions, open an issue or reach the project maintainer.
