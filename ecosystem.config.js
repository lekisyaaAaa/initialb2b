module.exports = {
  apps: [
    {
      name: 'beantobin-backend',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'beantobin-frontend',
      script: 'serve-build.js',
      cwd: './frontend',
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
