module.exports = {
  apps: [
    {
      name: 'beantobin-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false
    },
    {
      name: 'beantobin-poller',
      script: 'services/sensor-poller.js',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
