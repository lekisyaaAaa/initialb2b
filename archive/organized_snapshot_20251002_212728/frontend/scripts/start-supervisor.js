#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || '3002';
const HOST = process.env.HOST || '0.0.0.0';
// currentPort is the integer port we try to bind to; supervisor can increment it
let currentPort = parseInt(PORT, 10) || 3002;
const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
// Consolidated supervisor event log
const LOG_FILE = path.join(LOG_DIR, 'supervisor.log');
// Per-run child output log (timestamped to avoid file locks when multiple supervisors start)
const RUN_LOG_FILE = path.join(LOG_DIR, `supervisor_run_${Date.now()}.log`);

let restarts = 0;
const MAX_RESTARTS = 25; // avoid infinite loops
const RESTART_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
let restartTimestamps = [];

function writeLog(line) {
  const ts = new Date().toISOString();
  const out = `[supervisor] ${ts} ${line}\n`;
  try { fs.appendFileSync(LOG_FILE, out); } catch (err) { process.stderr.write(`Failed to write supervisor log: ${err.message}\n`); }
  process.stdout.write(out);
}

function findAndKillPidOnPort(port) {
  try {
    // netstat -ano | findstr ":<port>"
    const cmd = `netstat -ano | findstr ":${port}"`;
    const out = execSync(cmd, { encoding: 'utf8' });
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pids = new Set();
    for (const l of lines) {
      const parts = l.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(Number(pid))) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        // Only kill node.exe or matching process to be safe — check the executable
        const taskList = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' });
        if (/node.exe/i.test(taskList) || /react-scripts/i.test(taskList) || /node/i.test(taskList)) {
          writeLog(`Killing process ${pid} which was listening on port ${port}`);
          execSync(`taskkill /PID ${pid} /F`);
        } else {
          writeLog(`Found process ${pid} on port ${port} but not node/react-scripts; skipping kill (tasklist: ${taskList.trim()})`);
        }
      } catch (err) {
        writeLog(`Error checking/killing pid ${pid}: ${err.message}`);
      }
    }
  } catch (err) {
    // no listener found or command failed
    writeLog(`No netstat entry for port ${port} or error running netstat: ${err.message}`);
  }
}

function startServer() {
  restartTimestamps.push(Date.now());
  // prune timestamps
  restartTimestamps = restartTimestamps.filter(ts => Date.now() - ts < RESTART_WINDOW_MS);
  if (restartTimestamps.length > MAX_RESTARTS) {
    writeLog(`Too many restarts (${restartTimestamps.length}) in window; giving up.`);
    process.exit(1);
  }

  writeLog(`Starting react-scripts with HOST=${HOST} PORT=${currentPort} (restarts=${restartTimestamps.length})`);
  const env = Object.assign({}, process.env, { PORT: String(currentPort), HOST });

  // Use npm run start:dev originally called react-scripts in package.json, but spawn react-scripts directly
  const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['react-scripts', 'start'], {
    env,
    shell: true
  });

  // Write child stdout/stderr to a per-run file to avoid contention on a single file
  const logStream = fs.createWriteStream(RUN_LOG_FILE, { flags: 'a' });

  let portInUseDetected = false;
  child.stdout.on('data', chunk => {
    const text = chunk.toString();
    logStream.write(text);
    process.stdout.write(text);
    // Watch for EADDRINUSE or listen errors
    if (/EADDRINUSE|address already in use|listen EADDRINUSE/i.test(text) || /Something is already running on port\s*\d+/i.test(text)) {
      writeLog('Detected address-in-use message from react-scripts output');
      portInUseDetected = true;
      // try to kill any PID on the attempted port
      findAndKillPidOnPort(currentPort);
    }
  });

  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    logStream.write(text);
    process.stderr.write(text);
    if (/EADDRINUSE|address already in use|listen EADDRINUSE/i.test(text) || /Something is already running on port\s*\d+/i.test(text)) {
      writeLog('Detected address-in-use message on stderr');
      portInUseDetected = true;
      findAndKillPidOnPort(currentPort);
    }
  });

  child.on('exit', (code, signal) => {
    logStream.write(`react-scripts exited with code=${code} signal=${signal}\n`);
    writeLog(`react-scripts exited with code=${code} signal=${signal}`);
    // If we detected a port-in-use condition, try the next port (avoid infinite loop)
    if (portInUseDetected) {
      const nextPort = currentPort + 1;
      if (nextPort <= currentPort + 5) {
        writeLog(`Port ${currentPort} reported in use; trying next port ${nextPort}`);
        currentPort = nextPort;
      } else {
        writeLog(`Tried ${currentPort}..${nextPort} and still failing; will retry same port later`);
      }
    }

    // small backoff
    const backoff = Math.min(5000 + restartTimestamps.length * 500, 30000);
    writeLog(`Restarting in ${backoff}ms...`);
    setTimeout(() => startServer(), backoff);
  });

  // propagate signals
  process.on('SIGINT', () => {
    writeLog('Supervisor received SIGINT, shutting down child');
    child.kill('SIGINT');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    writeLog('Supervisor received SIGTERM, shutting down child');
    child.kill('SIGTERM');
    process.exit(0);
  });
}

// Ensure log exists
fs.appendFileSync(LOG_FILE, `\n=== Supervisor starting at ${new Date().toISOString()} ===\n`);
startServer();
