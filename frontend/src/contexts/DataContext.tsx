import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SensorData, Alert } from '../types';
import api, { alertService, sensorService, discoverApi } from '../services/api';
import weatherService, { type WeatherData } from '../services/weatherService';

interface DataContextType {
  latestSensorData: SensorData[];
  recentAlerts: Alert[];
  isConnected: boolean;
  isLoading: boolean;
  refreshData: () => Promise<void>;
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

  const fetchSensorDataFromBackend = useCallback(async (): Promise<{ readings: SensorData[] }> => {
    const response = await sensorService.getLatestData();
    const payload = response?.data?.data;

    if (Array.isArray(payload)) {
      return { readings: payload as SensorData[] };
    }

    if (payload && typeof payload === 'object') {
      return { readings: [payload as SensorData] };
    }

    return { readings: [] };
  }, []);

  const fetchAlertsFromBackend = useCallback(async (): Promise<Alert[]> => {
    const response = await alertService.getRecentAlerts(5);
    const payload = response?.data?.data;
    if (Array.isArray(payload)) return payload as Alert[];
    return [];
  }, []);

  const refreshData = useCallback(async () => {
    if (isCurrentlyLoading.current) {
      return;
    }

    isCurrentlyLoading.current = true;
    setIsLoading(true);
    setLastFetchError(null);

    try {
      await ensureBackendBase();

      const { readings: backendSensorData } = await fetchSensorDataFromBackend();

      setIsConnected(true);
      setLastFetchAt(new Date().toISOString());

      if (backendSensorData.length > 0) {
        setLatestSensorData(backendSensorData);
        setLastFetchCount(backendSensorData.length);
      } else {
        setLatestSensorData([]);
        setLastFetchCount(0);
      }

      try {
        const alerts = await fetchAlertsFromBackend();
        setRecentAlerts(alerts);
      } catch (alertsErr: any) {
        setRecentAlerts([]);
        setLastFetchError((alertsErr?.message as string) || 'Failed to fetch alerts');
      }
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
  }, [ensureBackendBase, fetchAlertsFromBackend, fetchSensorDataFromBackend]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
