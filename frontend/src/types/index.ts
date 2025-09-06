export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  lastLogin?: Date;
  loginCount?: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface SensorData {
  _id?: string;
  deviceId: string;
  temperature: number;
  humidity: number;
  moisture: number;
  timestamp: string;
  status: 'normal' | 'warning' | 'critical';
  batteryLevel?: number;
  signalStrength?: number;
  isOfflineData?: boolean;
}

export interface Alert {
  _id: string;
  type: 'temperature' | 'humidity' | 'moisture' | 'device_offline' | 'device_online' | 'battery_low';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  deviceId: string;
  sensorData: Partial<SensorData>;
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
}

export interface Settings {
  thresholds: {
    temperature: {
      warning: number;
      critical: number;
    };
    humidity: {
      warning: number;
      critical: number;
    };
    moisture: {
      warning: number;
      critical: number;
    };
    batteryLevel: {
      warning: number;
      critical: number;
    };
  };
  sms: {
    enabled: boolean;
    phoneNumbers: Array<{
      _id: string;
      name: string;
      number: string;
      isActive: boolean;
    }>;
    rateLimitMinutes: number;
  };
  monitoring: {
    dataCollectionInterval: number;
    offlineTimeoutMinutes: number;
    dataRetentionDays: number;
  };
  system: {
    timezone: string;
    autoResolveAlerts: boolean;
    autoResolveTimeMinutes: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface PaginationInfo {
  current: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<{
  items: T[];
  pagination: PaginationInfo;
}> {}

export interface SensorStats {
  avgTemperature: number;
  maxTemperature: number;
  minTemperature: number;
  avgHumidity: number;
  maxHumidity: number;
  minHumidity: number;
  avgMoisture: number;
  maxMoisture: number;
  minMoisture: number;
  count: number;
}

export interface AlertStats {
  summary: {
    total: number;
    resolved: number;
    unresolved: number;
  };
  breakdown: Array<{
    _id: string;
    types: Array<{
      type: string;
      count: number;
    }>;
    total: number;
  }>;
  period: string;
}
