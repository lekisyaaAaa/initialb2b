const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

function resolveLevel() {
  const raw = (process.env.LOG_LEVEL || '').toLowerCase();
  const idx = levels.indexOf(raw);
  if (idx !== -1) {
    return idx;
  }
  // default to 'info' in production, 'debug' otherwise
  return process.env.NODE_ENV === 'production' ? levels.indexOf('info') : levels.indexOf('debug');
}

let cachedLevelIndex;

function levelEnabled(level) {
  if (cachedLevelIndex === undefined) {
    cachedLevelIndex = resolveLevel();
  }
  const idx = levels.indexOf(level);
  return idx <= cachedLevelIndex;
}

function logAt(level, ...args) {
  if (!levelEnabled(level)) {
    return;
  }
  const prefix = `[${level.toUpperCase()}]`;
  const target = level === 'error' || level === 'fatal' ? console.error : level === 'warn' ? console.warn : console.log;
  target(prefix, ...args);
}

module.exports = {
  fatal: (...args) => logAt('fatal', ...args),
  error: (...args) => logAt('error', ...args),
  warn: (...args) => logAt('warn', ...args),
  info: (...args) => logAt('info', ...args),
  debug: (...args) => logAt('debug', ...args),
  trace: (...args) => logAt('trace', ...args),
};
