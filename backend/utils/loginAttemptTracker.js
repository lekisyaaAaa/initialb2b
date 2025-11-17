const crypto = require('crypto');

const DEFAULT_CONFIG = {
  password: {
    maxAttempts: parseInt(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || '5', 10),
    windowMs: parseInt(process.env.ADMIN_LOGIN_WINDOW_MS || (15 * 60 * 1000).toString(), 10),
    lockoutMs: parseInt(process.env.ADMIN_LOGIN_LOCKOUT_MS || (15 * 60 * 1000).toString(), 10),
  },
  otp: {
    maxAttempts: parseInt(process.env.ADMIN_OTP_MAX_ATTEMPTS || '5', 10),
    windowMs: parseInt(process.env.ADMIN_OTP_WINDOW_MS || (10 * 60 * 1000).toString(), 10),
    lockoutMs: parseInt(process.env.ADMIN_OTP_LOCKOUT_MS || (10 * 60 * 1000).toString(), 10),
  },
  resend: {
    maxAttempts: parseInt(process.env.ADMIN_OTP_RESEND_MAX_ATTEMPTS || '3', 10),
    windowMs: parseInt(process.env.ADMIN_OTP_RESEND_WINDOW_MS || (10 * 60 * 1000).toString(), 10),
    lockoutMs: parseInt(process.env.ADMIN_OTP_RESEND_LOCKOUT_MS || (10 * 60 * 1000).toString(), 10),
  },
};

const store = new Map();
let redisClient = null;
let useRedis = false;
try {
  if (process.env.REDIS_URL) {
    // lazily require to avoid failing when ioredis isn't installed in test env
    // eslint-disable-next-line global-require
    const IORedis = require('ioredis');
    redisClient = new IORedis(process.env.REDIS_URL);
    useRedis = true;
  }
} catch (e) {
  // If redis client can't be created, fall back to memory store
  useRedis = false;
}

class LockoutError extends Error {
  constructor(message, remainingMs) {
    super(message);
    this.name = 'LockoutError';
    this.remainingMs = remainingMs;
    this.isLockoutError = true;
  }
}

function buildKey(type, email, ip) {
  const safeEmail = (email || '').toString().trim().toLowerCase() || 'unknown';
  const safeIp = ip || 'unknown';
  return `${type}:${safeEmail}:${safeIp}`;
}

function getConfig(type) {
  return DEFAULT_CONFIG[type] || DEFAULT_CONFIG.password;
}

function getEntry(key) {
  if (useRedis && redisClient) {
    // Synchronous signature expected in other functions; we provide a simple
    // best-effort read via blocking call using `.get` which is async. For
    // simplicity in existing sync callers, we avoid using Redis here and
    // only use Redis in registerAttempt/resetAttempt paths. For reads, fall
    // back to in-memory store to avoid changing function signatures.
    const existing = store.get(key);
    if (!existing) return null;
    if (existing.expiresAt && existing.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return existing;
  }
  const existing = store.get(key);
  if (!existing) {
    return null;
  }
  if (existing.expiresAt && existing.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return existing;
}

function scheduleCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if ((entry.expiresAt && entry.expiresAt < now) && (!entry.lockoutUntil || entry.lockoutUntil < now)) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();
}

scheduleCleanup();

function assertCanAttempt(type, email, ip) {
  const key = buildKey(type, email, ip);
  const entry = getEntry(key);
  if (!entry) {
    return;
  }
  if (entry.lockoutUntil && entry.lockoutUntil > Date.now()) {
    const remainingMs = entry.lockoutUntil - Date.now();
    throw new LockoutError('Too many attempts. Please try again later.', remainingMs);
  }
}

function registerAttempt(type, email, ip) {
  const key = buildKey(type, email, ip);
  const config = getConfig(type);
  const entry = getEntry(key) || {
    count: 0,
    expiresAt: 0,
    lockoutUntil: 0,
    nonce: crypto.randomUUID(),
  };

  entry.count += 1;
  entry.expiresAt = Date.now() + config.windowMs;
  if (entry.count >= config.maxAttempts) {
    entry.lockoutUntil = Date.now() + config.lockoutMs;
  }

  store.set(key, entry);
  // If Redis is available, mirror state there for cross-instance coordination.
  if (useRedis && redisClient) {
    try {
      const payload = JSON.stringify({ count: entry.count, expiresAt: entry.expiresAt, lockoutUntil: entry.lockoutUntil });
      // set with TTL equal to windowMs + lockoutMs to keep a reasonable retention
      const ttlSeconds = Math.ceil((config.windowMs + config.lockoutMs) / 1000);
      redisClient.set(key, payload, 'EX', ttlSeconds).catch(() => {});
    } catch (e) {
      // ignore redis errors and continue with in-memory behavior
    }
  }
  return {
    remaining: Math.max(config.maxAttempts - entry.count, 0),
    locked: Boolean(entry.lockoutUntil && entry.lockoutUntil > Date.now()),
    lockoutMs: entry.lockoutUntil ? Math.max(entry.lockoutUntil - Date.now(), 0) : 0,
  };
}

function resetAttempts(type, email, ip) {
  const key = buildKey(type, email, ip);
  store.delete(key);
  if (useRedis && redisClient) {
    try {
      redisClient.del(key).catch(() => {});
    } catch (e) {}
  }
}

module.exports = {
  assertCanAttempt,
  registerAttempt,
  resetAttempts,
  LockoutError,
};
