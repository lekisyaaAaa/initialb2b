const { fork } = require('child_process');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node run-no-debug.js <script-to-run.js> [args...]');
  process.exit(2);
}

const target = path.resolve(process.cwd(), process.argv[2]);
const args = process.argv.slice(3);

const env = Object.assign({}, process.env);
// Remove noisy debug env vars that cause MODULE/NET internal logs
delete env.NODE_DEBUG;
delete env.DEBUG;
delete env.NODE_OPTIONS;
delete env.NPM_CONFIG_LOGLEVEL;

const child = fork(target, args, { env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code));
