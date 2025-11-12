import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SensorData, Alert, ApiResponse } from '../types';
import api, { alertService, sensorService, discoverApi } from '../services/api';
import { socket as sharedSocket } from '../socket';
import weatherService, { type WeatherData } from '../services/weatherService';

interface DataContextType {
  latestSensorData: SensorData[];
  recentAlerts: Alert[];
  isConnected: boolean;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  clearAlerts: () => Promise<void>;
  // lightweight debug info
  lastFetchCount: number;
  lastFetchAt?: string | null;
  lastFetchError?: string | null;
  clearLastFetchError: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

const ENABLE_WEATHER_FALLBACK = process.env.REACT_APP_ENABLE_WEATHER_FALLBACK === 'true';

const backendBaseFromApi = () => {
  const current = api.defaults.baseURL || '';
  if (!current) return '';
  return current.replace(/\/?api$/i, '');
};

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [latestSensorData, setLatestSensorData] = useState<SensorData[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchCount, setLastFetchCount] = useState(0);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const isCurrentlyLoading = useRef(false);
  const backendBaseRef = useRef<string>('');

  const ensureBackendBase = useCallback(async () => {
    if (backendBaseRef.current) return backendBaseRef.current;
    const fromApi = backendBaseFromApi();
    if (fromApi) {
      backendBaseRef.current = fromApi;
      return backendBaseRef.current;
    }
    try {
      const discovery = await discoverApi({ timeout: 1500 });
      if (discovery.ok && discovery.baseURL) {
        const normalized = discovery.baseURL.replace(/\/?api$/i, '');
        backendBaseRef.current = normalized;
        return backendBaseRef.current;
      }
    } catch (e) {
      // ignore discovery errors
    }
    return '';
  }, []);

  const fetchSensorDataFromBackend = useCallback(async (): Promise<{ readings: SensorData[]; connected: boolean }> => {
  const response = await sensorService.getLatestData();
  const root = (response?.data ?? {}) as (ApiResponse<SensorData | SensorData[] | null> & { status?: string });
    const payload = root?.data;
    const status = (root?.status || '').toString().toLowerCase();

    let readings: SensorData[] = [];
    if (Array.isArray(payload)) {
      readings = payload as SensorData[];
    } else if (payload && typeof payload === 'object') {
      readings = [payload as SensorData];
    }

    const anyConnected = readings.some((reading) => {
      const deviceOnline = (reading as any)?.deviceOnline;
      const deviceStatus = (reading as any)?.deviceStatus;
      const isStale = (reading as any)?.isStale;
      if (typeof deviceOnline === 'boolean') {
        return deviceOnline;
      }
      if (typeof deviceStatus === 'string') {
        return deviceStatus.toLowerCase() === 'online';
      }
      return isStale === false;
    });

    const connected = status === 'online' || anyConnected;

    if (!connected) {
      return { readings: [], connected: false };
    }

    return { readings, connected };
  }, []);

  const fetchAlertsFromBackend = useCallback(async (): Promise<Alert[]> => {
    const response = await alertService.getRecentAlerts(5);
    const payload = response?.data?.data;
    if (Array.isArray(payload)) return payload as Alert[];
    return [];
  }, []);

  const refreshAlerts = useCallback(async () => {
    try {
      const alerts = await fetchAlertsFromBackend();
      setRecentAlerts(alerts);
    } catch (err: any) {
      setRecentAlerts([]);
      setLastFetchError(err?.message || 'Failed to fetch alerts');
      throw err;
    }
  }, [fetchAlertsFromBackend]);

  const clearAlerts = useCallback(async () => {
    try {
      // Prefer new clear-all endpoint; fall back to resolve-all on failure
      try {
        await alertService.clearAll();
      } catch (e) {
        await alertService.resolveAll();
      }
      setLastFetchError(null);
      await refreshAlerts();
    } catch (err: any) {
      setLastFetchError(err?.message || 'Failed to clear alerts');
      throw err;
    }
  }, [refreshAlerts]);

  const refreshData = useCallback(async () => {
    if (isCurrentlyLoading.current) {
      return;
    }

    isCurrentlyLoading.current = true;
    setIsLoading(true);
    setLastFetchError(null);

    try {
      await ensureBackendBase();

      const { readings: backendSensorData, connected } = await fetchSensorDataFromBackend();

      setIsConnected(connected);
      setLastFetchAt(new Date().toISOString());

      if (connected && backendSensorData.length > 0) {
        setLatestSensorData(backendSensorData);
        setLastFetchCount(backendSensorData.length);
      } else {
        setLatestSensorData([]);
        setLastFetchCount(0);
      }

      await refreshAlerts().catch(() => {
        // refreshAlerts already updates local state and error message on failure.
      });
    } catch (error: any) {
      setIsConnected(false);
      setLastFetchAt(new Date().toISOString());

      if (ENABLE_WEATHER_FALLBACK) {
        try {
          const weatherData: WeatherData[] = await weatherService.getAllLocationsWeather();
          const synthesized = weatherData.map((weather) => ({
            _id: `weather_${weather.deviceId}_${Date.now()}`,
            deviceId: weather.deviceId,
            temperature: weather.temperature,
            humidity: weather.humidity,
            moisture: weather.moisture,
            ph: weather.ph,
            ec: weather.ec,
            nitrogen: weather.nitrogen,
            phosphorus: weather.phosphorus,
            potassium: weather.potassium,
            waterLevel: weather.waterLevel,
            timestamp: weather.timestamp,
            status: weather.status,
            batteryLevel: weather.batteryLevel,
            signalStrength: weather.signalStrength,
          }));
          setLatestSensorData(synthesized);
          setRecentAlerts([]);
          setLastFetchCount(synthesized.length);
          setLastFetchError('Backend unreachable. Showing fallback weather data.');
        } catch (fallbackError: any) {
          setLatestSensorData([]);
          setRecentAlerts([]);
          setLastFetchCount(0);
          setLastFetchError(fallbackError?.message || error?.message || 'Unable to reach backend');
        }
      } else {
    setLatestSensorData([]);
    setRecentAlerts([]);
    setLastFetchCount(0);
    setLastFetchError(error?.message || 'Unable to reach backend');
      }
    } finally {
      isCurrentlyLoading.current = false;
      setIsLoading(false);
    }
  }, [ensureBackendBase, fetchSensorDataFromBackend, refreshAlerts]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Realtime subscriptions: telemetry and alerts
  useEffect(() => {
    const socket = sharedSocket;
    if (!socket) return;

    const handleTelemetry = (payload: any) => {
      if (!payload) return;
      const sample = Array.isArray(payload) ? payload[0] : payload;
      if (!sample || typeof sample !== 'object') return;

      // Apply the same connectivity heuristics we use for REST polling.
      const deviceOnline = (sample as any)?.deviceOnline;
      const deviceStatus = ((sample as any)?.deviceStatus || (sample as any)?.status || '').toString().toLowerCase();
      const isStale = (sample as any)?.isStale;
      const connected = (typeof deviceOnline === 'boolean' && deviceOnline === true)
        || deviceStatus === 'online'
        || isStale === false;

      if (!connected) {
        // Ignore stale/offline telemetry so the UI doesn't show phantom data
        // when only the ESP32 is present without sensors.
        setIsConnected(false);
        return;
      }

      setLatestSensorData([sample as SensorData]);
      setIsConnected(true);
      setLastFetchAt(new Date().toISOString());
      setLastFetchCount(1);
    };

    const handleAlertTrigger = () => {
      refreshAlerts().catch(() => {});
    };

    socket.on('telemetry:update', handleTelemetry);
    socket.on('sensor_update', handleTelemetry); // backward compat
    socket.on('alert:trigger', handleAlertTrigger);

    return () => {
      socket.off('telemetry:update', handleTelemetry);
      socket.off('sensor_update', handleTelemetry);
      socket.off('alert:trigger', handleAlertTrigger);
    };
  }, [refreshAlerts]);

  // Periodic data refresh with graceful failure handling
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;
    const baseInterval = 5000; // 5 seconds
    const maxInterval = 60000; // 1 minute max backoff

    const pollData = async () => {
      try {
        // Only poll if we have a valid token (user is logged in)
        const token = localStorage.getItem('token');
        if (!token) {
          return;
        }

        await refreshData();
        consecutiveFailures = 0; // Reset on success

        // Schedule next poll
        intervalId = setTimeout(pollData, baseInterval);

      } catch (error: any) {
        consecutiveFailures++;
        console.warn(`DataContext: Poll failed (${consecutiveFailures}/${maxConsecutiveFailures})`, error.message);

        // If too many consecutive failures, increase interval (exponential backoff)
        if (consecutiveFailures >= maxConsecutiveFailures) {
          const backoffInterval = Math.min(baseInterval * Math.pow(2, consecutiveFailures - maxConsecutiveFailures), maxInterval);
          intervalId = setTimeout(pollData, backoffInterval);
        } else {
          // Retry sooner for initial failures
          intervalId = setTimeout(pollData, baseInterval);
        }

        // If network error, mark as disconnected
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          setIsConnected(false);
        }
      }
    };

    // Start polling after a brief delay
    const startPolling = () => {
      intervalId = setTimeout(pollData, 2000);
    };

    startPolling();

    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [refreshData]); // include refreshData to satisfy hook dependency

  const value: DataContextType = {
    latestSensorData,
    recentAlerts,
    isConnected,
    isLoading,
    refreshData,
    refreshAlerts,
    clearAlerts,
  lastFetchCount,
  lastFetchAt,
  lastFetchError,
  clearLastFetchError: () => setLastFetchError(null),
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
