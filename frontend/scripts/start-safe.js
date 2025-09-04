#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const os = require('os');

const port = process.env.PORT || 3002;

function killByPort(port) {
  try {
    if (os.platform() === 'win32') {
      // netstat output -> find PIDs
      const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });
      const lines = out.split(/\r?\n/).filter(Boolean);
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
          console.log(`Stopped process ${pid} on port ${port}`);
        } catch (err) {
          console.warn(`Could not stop PID ${pid}: ${err.message}`);
        }
      }
    } else {
      // unix-like: lsof
      try {
        const out = execSync(`lsof -i :${port} -t`, { encoding: 'utf8' });
        const pids = out.split(/\r?\n/).filter(Boolean);
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`);
            console.log(`Killed PID ${pid} on port ${port}`);
          } catch (err) {
            console.warn(`Could not kill PID ${pid}: ${err.message}`);
          }
        }
      } catch (err) {
        /* nothing listening */
      }
    }
  } catch (err) {
    // best-effort only
    // don't crash the starter if detection fails
  }
}

(async () => {
  console.log(`Safe-start: ensuring port ${port} is free...`);
  killByPort(port);

  console.log('Launching react-scripts start');
  const child = spawn('react-scripts', ['start'], { stdio: 'inherit', shell: true });
  child.on('exit', (code) => process.exit(code));
})();
