import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SensorData, Alert } from '../types';
import { alertService, sensorService } from '../services/api';
import weatherService, { type WeatherData } from '../services/weatherService';
import mockData from '../mocks/mockData';

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

// Small helper moved outside loops to avoid creating functions inside loops (ESLint no-loop-func)
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [latestSensorData, setLatestSensorData] = useState<SensorData[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchCount, setLastFetchCount] = useState(0);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  // const hasInitiallyFetched = useRef(false); // Temporarily disabled
  const isCurrentlyLoading = useRef(false);
  const cooldownActive = useRef(false);

  // WebSocket connection - COMPLETELY DISABLED

  // If WebSocket is disabled, mark connection as available (polling mode)
  useEffect(() => {
    const enableWs = process.env.REACT_APP_ENABLE_WS === 'true';
    if (!enableWs) {
      setIsConnected(true);
    }
  }, []);

  const refreshData = useCallback(async () => {
    console.log('DataContext: refreshData called - START');
    
    // Prevent multiple simultaneous calls using refs
    if (isCurrentlyLoading.current || cooldownActive.current) {
      console.log('DataContext: refreshData blocked - already loading or in cooldown');
      return;
    }

    console.log('DataContext: refreshData called at', new Date().toISOString());
    
    // Set cooldown to prevent rapid successive calls
    cooldownActive.current = true;
    setTimeout(() => {
      cooldownActive.current = false;
    }, 5000); // 5 second cooldown
    
    isCurrentlyLoading.current = true;
    setIsLoading(true);
    
    console.log('DataContext: Starting Manila weather service call...');
    setLastFetchError(null);

    try {
      // Retry logic with exponential backoff
    const maxRetries = 3;
    let attempt = 0;
    let backoff = 1000; // 1s
    let weatherData: WeatherData[] | null = null;

    while (attempt <= maxRetries) {
      try {
        weatherData = await weatherService.getAllLocationsWeather();
        console.log('DataContext: Weather service returned:', weatherData);
        break;
      } catch (err: any) {
        attempt += 1;
        console.error(`DataContext: weatherService attempt ${attempt} failed`, err);
        if (attempt > maxRetries) {
          // rethrow to outer catch
          throw err;
        }
  // wait before retrying using top-level helper to avoid function-in-loop ESLint errors
  // backoff doubles each retry (exponential backoff)
  await sleep(backoff);
  backoff *= 2;
      }
    }

    console.log('DataContext: Manila weather data received:', weatherData);

    if (weatherData && weatherData.length > 0) {
        // Convert Manila weather data to sensor data format
        const sensorData: SensorData[] = weatherData.map((weather: WeatherData) => ({
          _id: `manila_weather_${weather.deviceId}_${Date.now()}`,
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

        console.log('DataContext: Manila sensor data:', sensorData);
        
        setLatestSensorData(sensorData);
        setIsConnected(true);
  setLastFetchCount(sensorData.length);
  setLastFetchAt(new Date().toISOString());
        
        console.log(`DataContext: Updated with ${sensorData.length} Manila weather readings`);
      } else {
        console.log('DataContext: Weather service returned empty, trying backend...');
        // Try backend API as a fallback when weather service returns nothing
        try {
          const resp = await sensorService.getLatestData();
          console.log('DataContext: Backend response:', resp);
          if (resp && resp.data && resp.data.success) {
            const payload = Array.isArray(resp.data.data) ? resp.data.data : (resp.data.data ? [resp.data.data] : []);
            console.log('DataContext: Backend payload:', payload);
            if (payload.length > 0) {
              setLatestSensorData(payload as any);
              setIsConnected(true);
              setLastFetchCount(payload.length);
              setLastFetchAt(new Date().toISOString());
            } else {
              // No real sensor data available - set empty array
              console.log('DataContext: No sensor data available from backend - setting empty array');
              setLatestSensorData([]);
              console.log('DataContext: latestSensorData set to empty array');
              setIsConnected(false);
              setLastFetchCount(0);
              setLastFetchAt(new Date().toISOString());
              setLastFetchError(null);
            }
          } else {
            console.log('DataContext: Backend returned no latest data');
            setLatestSensorData([]);
            setIsConnected(false);
            setLastFetchCount(0);
            setLastFetchAt(new Date().toISOString());
            setLastFetchError(null);
          }
        } catch (be) {
          const beMsg = (be && (be as any).message) ? (be as any).message : String(be);
          console.log('DataContext: Backend latest data fetch failed', beMsg);
          setLatestSensorData([]);
          setIsConnected(false);
          setLastFetchCount(0);
          setLastFetchAt(new Date().toISOString());
          setLastFetchError(`Backend connection failed: ${beMsg}`);
        }
      }

      // Try to fetch alerts from backend (if available)
      try {
        const alertResponse = await alertService.getRecentAlerts(5);
        if (alertResponse && alertResponse.data && alertResponse.data.success && Array.isArray(alertResponse.data.data)) {
          setRecentAlerts(alertResponse.data.data as any[]);
        } else {
          setRecentAlerts(mockData.mockAlerts as any[]);
        }
      } catch (alertError) {
        console.log('Could not fetch alerts from backend, falling back to mock alerts');
        setRecentAlerts(mockData.mockAlerts);
        setLastFetchError((alertError as any)?.message || 'Failed to fetch alerts - using mock alerts');
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      // Set empty arrays when no sensors are connected - don't fall back to mock data
      setIsConnected(false);
      setLatestSensorData([]);
      setRecentAlerts([]);
      setLastFetchCount(0);
      setLastFetchAt(new Date().toISOString());
      setLastFetchError(null);
    } finally {
      isCurrentlyLoading.current = false;
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch - DISABLED AGAIN to stop refresh loop
  /*
  useEffect(() => {
    console.log('DataContext: Initial fetch starting with weather service');
    
    // Prevent multiple initial fetches using ref
    if (hasInitiallyFetched.current) {
      console.log('DataContext: Initial fetch already completed, skipping');
      return;
    }

    const initialFetch = async () => {
      console.log('DataContext: Initial data fetch starting');
      hasInitiallyFetched.current = true; // Mark as fetched immediately to prevent re-runs
      
      if (isCurrentlyLoading.current) {
        console.log('DataContext: Already loading, skipping initial fetch');
        return;
      }

      await refreshData(); // Use the weather service data
    };

    initialFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY dependency array to prevent loops
  */

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
          console.log('DataContext: No auth token, skipping poll');
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
          console.warn(`DataContext: Too many failures, backing off to ${backoffInterval}ms`);
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
