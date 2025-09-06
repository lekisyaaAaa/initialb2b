import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, PaginatedResponse, SensorData, Alert, Settings, SensorStats, AlertStats } from '../types';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
