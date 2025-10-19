const { spawn } = require('child_process');
const path = require('path');

// Runs `npm run start:dev` but monitors startup and fails fast with diagnostics
const cwd = path.resolve(__dirname, '..');

console.log('[wrapped-start] Starting frontend (npm run start:dev) in', cwd);

// Use shell mode to avoid spawn issues on Windows (npm vs npm.cmd differences)
const child = spawn('npm run start:dev', { cwd, stdio: ['inherit', 'pipe', 'pipe'], env: process.env, shell: true });

let started = false;
let timeout = setTimeout(() => {
  if (!started) {
    console.error('[wrapped-start] Timeout: frontend did not report successful startup within 60s.');
    console.error('[wrapped-start] Last captured stdout/stderr:');
    if (lastStdout) console.error('--- STDOUT ---\n' + lastStdout);
    if (lastStderr) console.error('--- STDERR ---\n' + lastStderr);
    console.error('[wrapped-start] To debug: run `npm run start:dev` manually in the frontend folder.');
    child.kill();
    process.exit(4);
  }
}, 60000);

let lastStdout = '';
let lastStderr = '';

child.stdout.on('data', (d) => {
  const s = d.toString();
  process.stdout.write(s);
  lastStdout = (lastStdout + s).slice(-2000);
  if (/compiled (successfully|with warnings)/i.test(s) || /You can now view/i.test(s)) {
    started = true;
    clearTimeout(timeout);
    console.log('[wrapped-start] Frontend reported ready (warnings allowed).');
  }
});

child.stderr.on('data', (d) => {
  const s = d.toString();
  process.stderr.write(s);
  lastStderr = (lastStderr + s).slice(-2000);
  if (/error/i.test(s)) {
    // don't treat as immediate fatal; react-scripts prints recoverable compile errors here
  }
});

child.on('exit', (code, signal) => {
  clearTimeout(timeout);
  if (!started) {
    console.error('[wrapped-start] Frontend process exited before successful compile. Exit code:', code, 'signal:', signal);
    if (lastStdout) console.error('--- STDOUT ---\n' + lastStdout);
    if (lastStderr) console.error('--- STDERR ---\n' + lastStderr);
    process.exit(code || 1);
  }
  console.log('[wrapped-start] Frontend process exited (code', code, 'signal', signal, ')');
  process.exit(code || 0);
});

process.on('SIGINT', () => { child.kill(); process.exit(0); });
process.on('SIGTERM', () => { child.kill(); process.exit(0); });
