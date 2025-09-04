module.exports = {
  apps: [{
    name: 'frontend-server',
    script: 'npx',
    args: 'http-server build -p 3002 -c-1 --cors',
    cwd: '/c/xampp/htdocs/beantobin/system/frontend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
