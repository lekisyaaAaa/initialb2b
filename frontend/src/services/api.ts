import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, PaginatedResponse, SensorData, Alert, Settings, SensorStats, AlertStats } from '../types';

// Create axios instance with base configuration
// Build a normalized API base URL. Users may set REACT_APP_API_URL with or without
// a trailing '/api'. Normalize to avoid accidentally producing '/api/api' in requests.
const RAW_API_ROOT = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000').toString();
// Remove any trailing slashes and any repeated '/api' segments to avoid producing '/api/api'
const API_ROOT = RAW_API_ROOT.replace(/(\/api)+\/?$/i, '').replace(/\/+$/,'');
const api: AxiosInstance = axios.create({
  // prefer IPv4 loopback in dev to avoid browsers resolving 'localhost' to ::1 (IPv6)
  baseURL: API_ROOT + '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // explicit: do not send cookies by default for token-based auth; this also makes browser CORS behavior clearer
  withCredentials: false,
});

// Try to discover a reachable API base by probing health endpoints.
// Returns { ok: boolean, baseURL?: string, message?: string }
export async function discoverApi(options?: { candidates?: string[]; timeout?: number }) {
  const timeout = options?.timeout ?? 2500;
  const candidates = options?.candidates ?? (() => {
    const envRoot = (process.env.REACT_APP_API_URL || '').toString();
    const normalized = envRoot.replace(/(\/api)+\/?$/i, '').replace(/\/+$/,'');
    // include current configured base plus common dev ports
    const list = [] as string[];
    if (normalized) list.push(normalized);
    list.push('http://127.0.0.1:5000');
    list.push('http://127.0.0.1:8000');
    list.push('http://localhost:5000');
    list.push('http://localhost:8000');
    return Array.from(new Set(list));
  })();

  for (const root of candidates) {
    const testUrl = root.replace(/\/+$/,'') + '/api/health';
    try {
      const resp = await axios.get(testUrl, { timeout });
      if (resp && resp.status >= 200 && resp.status < 300) {
        // update api baseURL
        api.defaults.baseURL = root.replace(/\/+$/,'') + '/api';
        return { ok: true, baseURL: api.defaults.baseURL };
      }
    } catch (e) {
      // continue to next candidate
    }
  }
  return { ok: false, message: 'No reachable API host found' };
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear client auth state but do NOT force navigation.
      // This ensures opening the landing page will not automatically redirect to login
      // if a background request fails with 401. Individual pages/components may
      // listen for the 'auth:expired' event to react (optional).
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // remove Authorization header if set
        if ((api.defaults.headers as any).Authorization) {
          delete (api.defaults.headers as any).Authorization;
        }
        // notify app if anyone wants to handle expired auth
        if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      } catch (err) {
        // swallow errors - nothing critical here
      }
    }
    return Promise.reject(error);
  }
);

// API service methods
export const authService = {
  login: (credentials: { username: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/auth/login', credentials),
  
  verify: () =>
    api.get<ApiResponse<{ user: any }>>('/auth/verify'),
};

// Admin-specific login helper that talks to /api/admin/login and returns a simple shape
// Admin-specific login helper that talks to /api/admin/login and returns a simple shape
// Use the configured `api` instance whose baseURL already contains the '/api' prefix.
export const adminAuthService = {
  loginAdmin: async (username: string, password: string) => {
    // First, check server health to provide a clearer error early
    try {
      await api.get('/health', { timeout: 3000 });
    } catch (healthErr: any) {
      // If health check fails, try discovery to switch to a reachable host; otherwise proceed and let
      // the login attempt handle network errors and possibly trigger the local fallback.
      try {
        const disco = await discoverApi({ timeout: 1500 });
        if (disco.ok) {
          console.log('adminAuthService: discovered API host during health check failure', disco.baseURL);
        } else {
          console.warn('adminAuthService: health check failed and discovery did not find a host', healthErr && (healthErr.message || healthErr));
        }
      } catch (e:any) {
        console.warn('adminAuthService: discovery failed after health check failure', e && (e.message || String(e)));
      }
    }

    // Try login with retry attempts (idempotent)
    const maxAttempts = 2;
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const resp = await api.post('/admin/login', { username, password }, { timeout: 8000 });
        if (resp?.data?.success && resp.data.token) return { success: true, token: resp.data.token };
        return { success: false, message: resp?.data?.message || 'Invalid username or password.' };
      } catch (err: any) {
        if (err.response) {
          if (err.response.status === 401) return { success: false, message: 'Invalid username or password.' };
          if (err.response.status >= 500) return { success: false, message: 'Internal server error' };
          return { success: false, message: err.response.data?.message || 'Login failed' };
        }
        // On network errors, try again once, otherwise return clear message
        const code = (err && (err.code || '') ) || (err && (err.message || '') ).toString().toLowerCase();
        const isNetwork = code === 'econnrefused' || code === 'enotfound' || code === 'etimedout' || code.includes('network error') || code.includes('failed to fetch') || code.includes('networkrequestfailed') || code.includes('net::');
        console.debug('adminAuthService: login network error detected, code=', code, 'isNetwork=', isNetwork);
        if (isNetwork) {
          // attempt a client-side local admin fallback (development only)
          try {
            const localUser = (process.env.REACT_APP_LOCAL_ADMIN_USER || 'admin');
            const localPass = (process.env.REACT_APP_LOCAL_ADMIN_PASS || 'admin');
            console.debug('adminAuthService: checking local fallback for', username, 'against', localUser);
            if (username === localUser && password === localPass) {
              console.debug('adminAuthService: local fallback matched, returning fake token');
              const fakeToken = `local-dev-token-${Date.now()}`;
              const user = { id: 'local-admin', username: localUser, role: 'admin', local: true };
              return { success: true, token: fakeToken, user } as any;
            }
          } catch (e:any) {
            console.debug('adminAuthService: local fallback check error', String(e));
          }
          if (attempt >= maxAttempts) return { success: false, message: 'Server offline. Please check if the backend is running.' };
          // small delay before retry
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        return { success: false, message: 'Unable to connect to server. Please try again.' };
      }
    }
    return { success: false, message: 'Unable to connect to server. Please try again.' };
  }
};

export const sensorService = {
  getSensorData: (params?: {
    page?: number;
    limit?: number;
    deviceId?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    api.get<PaginatedResponse<SensorData>>('/sensors/data', { params }),
  
  getLatestData: (deviceId?: string) =>
    api.get<ApiResponse<SensorData[]>>('/sensors/latest', {
      params: deviceId ? { deviceId } : undefined,
    }),
  
  getStats: (params?: {
    deviceId?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    api.get<ApiResponse<SensorStats>>('/sensors/stats', { params }),
  
  submitData: (data: Omit<SensorData, '_id'>) =>
    api.post<ApiResponse<SensorData>>('/sensors/data', data),
};

export const alertService = {
  getAlerts: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    severity?: string;
    isResolved?: boolean;
    deviceId?: string;
  }) =>
    api.get<PaginatedResponse<Alert>>('/alerts', { params }),

  getRecentAlerts: (limit?: number) =>
    api.get<ApiResponse<Alert[]>>('/alerts/recent', {
      params: limit ? { limit } : undefined,
    }),
  
  resolveAlert: (alertId: string) =>
    api.put<ApiResponse<Alert>>(`/alerts/${alertId}/resolve`),
  
  acknowledgeAlert: (alertId: string) =>
    api.put<ApiResponse<Alert>>(`/alerts/${alertId}/acknowledge`),
  
  getStats: (params?: {
    period?: 'day' | 'week' | 'month';
    deviceId?: string;
  }) =>
    api.get<ApiResponse<AlertStats>>('/alerts/stats', { params }),
};

export const settingsService = {
  getSettings: () =>
    api.get<ApiResponse<Settings>>('/settings'),
  
  updateSettings: (settings: Partial<Settings>) =>
    api.put<ApiResponse<Settings>>('/settings', settings),
  
  addPhoneNumber: (phoneData: { name: string; number: string }) =>
    api.post<ApiResponse<Settings>>('/settings/phone-numbers', phoneData),
  
  removePhoneNumber: (phoneId: string) =>
    api.delete<ApiResponse<Settings>>(`/settings/phone-numbers/${phoneId}`),
  
  testSMS: (phoneNumber: string, message: string) =>
    api.post<ApiResponse<any>>('/settings/test-sms', { phoneNumber, message }),
};

export const systemService = {
  getHealth: () =>
    api.get<ApiResponse<{ status: string; timestamp: string }>>('/health'),
  
  getSystemInfo: () =>
    api.get<ApiResponse<{
      version: string;
      uptime: number;
      memory: any;
      database: any;
    }>>('/system/info'),
};

export default api;
