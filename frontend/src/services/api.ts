import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApiResponse,
  PaginatedResponse,
  SensorData,
  Alert,
  Settings,
  AlertRules,
  SensorStats,
  AlertStats,
  Actuator,
  NotificationItem,
  DeviceSensorSummary,
} from '../types';

// Create axios instance with base configuration
// Build a normalized API base URL. Users may set REACT_APP_API_URL with or without
// a trailing '/api'. Normalize to avoid accidentally producing '/api/api' in requests.
const RAW_API_ROOT = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000').toString();
// Remove any trailing slashes and any repeated '/api' segments to avoid producing '/api/api'
const API_ROOT = RAW_API_ROOT.replace(/(\/api)+\/?$/i, '').replace(/\/+$/,'');
export const API_BASE_URL = API_ROOT;
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
  loginAdmin: async (email: string, password: string) => {
    const normalizeRoot = (value?: string | null) => {
      if (!value) return '';
      return value.replace(/\s+/g, '').replace(/\/?api$/i, '').replace(/\/$/, '');
    };

    let discoveryBase = '';
    try {
      const result = await discoverApi({ timeout: 1500 });
      if (result.ok && result.baseURL) {
        discoveryBase = result.baseURL;
      }
    } catch (e) {
      // ignore discovery errors, candidates below cover defaults
    }

    const candidateRoots = new Set<string>();
    const pushCandidate = (value?: string | null) => {
      const normalized = normalizeRoot(value);
      if (normalized) candidateRoots.add(normalized);
    };

    pushCandidate(process.env.REACT_APP_API_URL);
    pushCandidate(discoveryBase);
    pushCandidate(api.defaults.baseURL);
    pushCandidate('http://127.0.0.1:5000');
    pushCandidate('http://127.0.0.1:8000');
    pushCandidate('http://localhost:5000');
    pushCandidate('http://localhost:8000');

    const roots = Array.from(candidateRoots);
    let networkIssueDetected = false;
    let serverErrorMessage: string | null = null;

    for (const root of roots) {
      try {
        const base = `${root.replace(/\/$/, '')}/api`;
        api.defaults.baseURL = base;
        const health = await api.get('/health', { timeout: 2000 }).catch(() => null);
        if (health && health.data && health.data.success === false) {
          // backend reported unhealthy; attempt login regardless to surface proper error
        }

        const payload = { email: email.trim().toLowerCase(), password };
        const resp = await api.post('/admin/login', payload, { timeout: 8000 });
        if (resp?.data?.success && resp.data.token) {
          const fallbackUser = resp.data.user || {
            id: 'admin-local',
            username: email,
            role: 'admin',
            source: 'admin-login',
          };
          return { success: true, token: resp.data.token, user: fallbackUser };
        }
        return { success: false, message: resp?.data?.message || 'Invalid username or password.' };
      } catch (err: any) {
        if (err?.response) {
          if (err.response.status === 401) {
            return { success: false, message: 'Invalid username or password.' };
          }
          if (err.response.status >= 500) {
            serverErrorMessage = err.response.data?.message || 'Internal server error';
            continue;
          }
          return { success: false, message: err.response.data?.message || 'Login failed' };
        }

        const lower = (err?.code || err?.message || '').toString().toLowerCase();
        const networkIssues = ['econnrefused', 'enotfound', 'etimedout', 'network error', 'failed to fetch', 'networkrequestfailed', 'net::'];
        if (networkIssues.some(keyword => lower.includes(keyword))) {
          networkIssueDetected = true;
          continue; // try the next candidate host
        }

        serverErrorMessage = err?.message || 'Unable to connect to server. Please try again.';
      }
    }

    if (networkIssueDetected) {
      return { success: false, message: 'Server offline. Please check if the backend is running.' };
    }

    if (serverErrorMessage) {
      return { success: false, message: serverErrorMessage };
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
    api.get<ApiResponse<SensorData | SensorData[] | null>>('/sensors/latest', {
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

  getLatestAlerts: () =>
    api.get<ApiResponse<Alert[]>>('/alerts/latest'),

  getActiveAlerts: (params?: { deviceId?: string; severity?: string; limit?: number; sort?: 'asc' | 'desc' }) =>
    api.get<ApiResponse<Alert[]>>('/alerts/active', { params }),

  createAlert: (alertData: {
    type: 'sensor' | 'connectivity' | 'threshold' | 'device_offline' | 'other';
    message: string;
    timestamp?: string;
  }) =>
    api.post<ApiResponse<Alert>>('/alerts', alertData),

  markAsRead: (alertId: string) =>
    api.patch<ApiResponse<Alert>>(`/alerts/${alertId}`),

  resolveAlert: (alertId: string) =>
    api.put<ApiResponse<Alert>>(`/alerts/${alertId}/resolve`),

  acknowledgeAlert: (alertId: string) =>
    api.put<ApiResponse<Alert>>(`/alerts/${alertId}/acknowledge`),

  resolveAll: (payload?: { deviceId?: string }) =>
    api.put<ApiResponse<{ resolved: number }>>('/alerts/resolve-all', payload),

  getStats: (params?: {
    period?: 'day' | 'week' | 'month';
    deviceId?: string;
  }) =>
    api.get<ApiResponse<AlertStats>>('/alerts/stats', { params }),
};

export const notificationService = {
  list: (params?: { status?: 'new' | 'read'; limit?: number }) =>
    api.get<ApiResponse<NotificationItem[]>>('/notifications', { params }),

  stats: () =>
    api.get<ApiResponse<{ total: number; unread: number; resolved: number }>>('/notifications/stats'),

  markAsRead: (notificationId: string) =>
    api.patch<ApiResponse<NotificationItem>>(`/notifications/${notificationId}/mark-read`),

  markAsUnread: (notificationId: string) =>
    api.patch<ApiResponse<NotificationItem>>(`/notifications/${notificationId}/mark-unread`),

  remove: (notificationId: string) =>
    api.delete<ApiResponse<NotificationItem>>(`/notifications/${notificationId}`),
};

export const deviceService = {
  list: () => api.get<ApiResponse<any[]>>('/devices'),
  getSensors: (deviceId: string, params?: { limit?: number }) =>
    api.get<ApiResponse<DeviceSensorSummary>>(`/devices/${encodeURIComponent(deviceId)}/sensors`, { params }),
};

export const actuatorService = {
  list: () => api.get<ApiResponse<Actuator[]>>('/actuators'),
  toggle: (id: number) => api.post<ApiResponse<Actuator>>(`/actuators/${id}/toggle`),
  setMode: (id: number, mode: 'manual' | 'auto') =>
    api.post<ApiResponse<Actuator>>(`/actuators/${id}/mode`, { mode }),
  runAutoControl: () => api.post<ApiResponse<any>>('/actuators/auto-control'),
  getLogs: (params?: { page?: number; limit?: number; deviceId?: string; actuatorType?: string }) =>
    api.get('/actuators/logs', { params }),
};

export const settingsService = {
  getSettings: () =>
    api.get<ApiResponse<Settings>>('/settings'),
  
  updateSettings: (settings: Partial<Settings>) =>
    api.put<ApiResponse<Settings>>('/settings', settings),

  getAlertRules: () =>
    api.get<ApiResponse<AlertRules>>('/settings/alerts'),

  updateAlertRules: (alerts: AlertRules) =>
    api.put<ApiResponse<AlertRules>>('/settings/alerts', { alerts }),
  
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

// Auto-run discovery at module import to set a reachable API baseURL early.
(async function autoDiscover() {
  try {
    const disco = await discoverApi({ timeout: 1200 });
    if (disco.ok) {
      console.log('api: auto-discovered API host', disco.baseURL);
    } else {
      console.debug('api: auto-discovery did not find a reachable API');
    }
  } catch (e: any) {
    console.debug('api: auto-discovery error', (e && (e.message || String(e))) || String(e));
  }
})();
