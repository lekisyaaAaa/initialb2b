import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SensorData, Alert } from '../types';
import { alertService } from '../services/api';
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

  // WebSocket connection - TEMPORARILY DISABLED to stop refresh loop
  // WebSocket connection (opt-in via REACT_APP_ENABLE_WS) - re-enabled with robust reconnect
  useEffect(() => {
    const enableWs = process.env.REACT_APP_ENABLE_WS === 'true';
    if (!enableWs) {
      console.log('DataContext: WebSocket disabled (REACT_APP_ENABLE_WS != true)');
      return;
    }

    let websocket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      try {
        const wsUrl = process.env.REACT_APP_WS_URL || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:5000`;
        console.log('DataContext: Connecting WebSocket to', wsUrl);
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          if (!isComponentMounted) {
            websocket?.close();
            return;
          }
          console.log('DataContext: WebSocket connected');
          setIsConnected(true);

          if (reconnectTimeout) {
            window.clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        };

        websocket.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const message = JSON.parse(event.data);
            // Support different message shapes: { type, data } or raw sensor object
            if (message) {
              if (message.type === 'sensor_data' && message.data) {
                const newData = Array.isArray(message.data) ? message.data : [message.data];
                setLatestSensorData(prevData => {
                  // Merge by deviceId (replace existing reading for device)
                  const updated = [...prevData];
                  newData.forEach((r: SensorData) => {
                    const idx = updated.findIndex(x => x.deviceId === r.deviceId);
                    if (idx >= 0) updated[idx] = r; else updated.push(r);
                  });
                  return updated;
                });
              } else if (message.type === 'alert' && message.data) {
                // Prepend alert
                setRecentAlerts(prev => [message.data as Alert, ...prev].slice(0, 50));
              } else if (message.deviceId && (message.temperature !== undefined || message.humidity !== undefined)) {
                // Raw sensor object
                const raw = message as SensorData;
                setLatestSensorData(prev => {
                  const updated = [...prev];
                  const idx = updated.findIndex(x => x.deviceId === raw.deviceId);
                  if (idx >= 0) updated[idx] = raw; else updated.push(raw);
                  return updated;
                });
              }
            }
          } catch (error) {
            console.error('DataContext: Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = (ev) => {
          if (!isComponentMounted) return;
          console.log('DataContext: WebSocket closed', ev);
          setIsConnected(false);

          // Exponential backoff capped at 1 minute
          const backoff = 5000;
          reconnectTimeout = window.setTimeout(() => {
            if (isComponentMounted) {
              console.log('DataContext: Reconnecting WebSocket...');
              connectWebSocket();
            }
          }, backoff);
        };

        websocket.onerror = (error) => {
          console.error('DataContext: WebSocket error:', error);
          setIsConnected(false);
        };

      } catch (error) {
        console.error('DataContext: Failed to create WebSocket connection:', error);
        setIsConnected(false);
        reconnectTimeout = window.setTimeout(() => {
          if (isComponentMounted) connectWebSocket();
        }, 5000);
      }
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (websocket) websocket.close();
    };
  }, []); // run once

  // If WebSocket is disabled, mark connection as available (polling mode)
  useEffect(() => {
    const enableWs = process.env.REACT_APP_ENABLE_WS === 'true';
    if (!enableWs) {
      setIsConnected(true);
    }
  }, []);

  const refreshData = useCallback(async () => {
    console.log('DataContext: Refreshing data with weather service');
    
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
        console.log('DataContext: No Manila weather data received or empty array - falling back to mock data');
        // Use mock data so UI remains functional during backend outages
        setLatestSensorData(mockData.mockSensorData);
        setIsConnected(false);
        setLastFetchCount(mockData.mockSensorData.length);
        setLastFetchAt(new Date().toISOString());
        setLastFetchError('No live weather data - using local mock data');
      }

      // Try to fetch alerts from backend (if available)
      try {
        const alertResponse = await alertService.getRecentAlerts(5);
        if (alertResponse.data.success && alertResponse.data.data) {
          setRecentAlerts(alertResponse.data.data);
        }
      } catch (alertError) {
        console.log('Could not fetch alerts from backend, falling back to mock alerts');
        setRecentAlerts(mockData.mockAlerts);
        setLastFetchError((alertError as any)?.message || 'Failed to fetch alerts - using mock alerts');
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      // Fall back to mock data so the UI remains usable offline
      setIsConnected(false);
      setLatestSensorData(mockData.mockSensorData);
      setRecentAlerts(mockData.mockAlerts);
      setLastFetchCount(mockData.mockSensorData.length);
      setLastFetchAt(new Date().toISOString());
      setLastFetchError(((error as any)?.message || 'Failed to fetch sensor data') + ' - using mock data');
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
  }, []); // Empty dependency array - this should only run once

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
