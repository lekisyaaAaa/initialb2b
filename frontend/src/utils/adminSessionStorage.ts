const TOKEN_KEY = 'token';
const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_REFRESH_TOKEN_KEY = 'adminRefreshToken';
const USER_KEY = 'user';
const ADMIN_USER_KEY = 'adminUser';

function safeStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    return window.localStorage;
  } catch (err) {
    return null;
  }
}

export function persistAdminSession(options: { token: string; refreshToken?: string; user?: any }) {
  const storage = safeStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(TOKEN_KEY, options.token);
    storage.setItem(ADMIN_TOKEN_KEY, options.token);
    if (options.refreshToken) {
      storage.setItem(ADMIN_REFRESH_TOKEN_KEY, options.refreshToken);
    }
    if (options.user) {
      const serialized = JSON.stringify(options.user);
      storage.setItem(USER_KEY, serialized);
      storage.setItem(ADMIN_USER_KEY, serialized);
    }
  } catch (err) {
    console.warn('persistAdminSession storage failure', err && ((err as any).message || err));
  }
}

export function loadAdminSession(): { token: string | null; refreshToken: string | null; user: any | null } {
  const storage = safeStorage();
  if (!storage) {
    return { token: null, refreshToken: null, user: null };
  }
  try {
    const token = storage.getItem(ADMIN_TOKEN_KEY) || storage.getItem(TOKEN_KEY);
    const refreshToken = storage.getItem(ADMIN_REFRESH_TOKEN_KEY) || null;
    const userRaw = storage.getItem(ADMIN_USER_KEY) || storage.getItem(USER_KEY);
    let user: any = null;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {
        user = null;
      }
    }
    return { token, refreshToken, user };
  } catch (err) {
    console.warn('loadAdminSession storage failure', err && ((err as any).message || err));
    return { token: null, refreshToken: null, user: null };
  }
}

export function clearAdminSession() {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  [TOKEN_KEY, ADMIN_TOKEN_KEY, ADMIN_REFRESH_TOKEN_KEY, USER_KEY, ADMIN_USER_KEY].forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  });
}

export const ADMIN_STORAGE_KEYS = {
  TOKEN_KEY,
  ADMIN_TOKEN_KEY,
  ADMIN_REFRESH_TOKEN_KEY,
  USER_KEY,
  ADMIN_USER_KEY,
};
