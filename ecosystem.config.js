module.exports = {
  apps: [
    {
      name: 'btb-backend',
      cwd: './backend',
      script: 'server.js',
      args: '',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'btb-ws-sim-smoke',
      cwd: './backend/scripts',
      script: 'ws-device-sim.js',
      args: 'ws://127.0.0.1:5000 smoke-sim-01',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        WS_URL: 'ws://127.0.0.1:5000',
        DEVICE_ID: 'smoke-sim-01'
      }
    },
    {
      name: 'btb-ws-sim-esp32',
      cwd: './backend/scripts',
      script: 'ws-device-sim.js',
      args: 'ws://127.0.0.1:5000 esp32-test-01',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        WS_URL: 'ws://127.0.0.1:5000',
        DEVICE_ID: 'esp32-test-01'
      }
    }
    ,
    {
      name: 'btb-frontend',
      cwd: './frontend',
      // Serve the production build via the included serve-build helper. This is more
      // reliable under PM2 than running the CRA dev server.
      script: 'scripts/serve-build.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
};
