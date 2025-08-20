import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SensorData, Alert } from '../types';
import { alertService } from '../services/api';
import weatherService, { type WeatherData } from '../services/weatherService';

interface DataContextType {
  latestSensorData: SensorData[];
  recentAlerts: Alert[];
  isConnected: boolean;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [latestSensorData, setLatestSensorData] = useState<SensorData[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  // const hasInitiallyFetched = useRef(false); // Temporarily disabled
  const isCurrentlyLoading = useRef(false);
  const cooldownActive = useRef(false);

  // WebSocket connection - TEMPORARILY DISABLED to stop refresh loop
  /*
  useEffect(() => {
    let websocket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      try {
        const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          if (!isComponentMounted) {
            websocket?.close();
            return;
          }
          console.log('WebSocket connected');
          setIsConnected(true);
          setWs(websocket);

          // Clear any pending reconnection attempts
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        };

        websocket.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'sensor_data' && message.data) {
              // Update sensor data in real-time
              setLatestSensorData(prevData => {
                const newData = Array.isArray(message.data) ? message.data : [message.data];
                const updatedData = [...prevData];
                newData.forEach((newReading: SensorData) => {
                  const existingIndex = updatedData.findIndex(
                    item => item.deviceId === newReading.deviceId
                  );
                  if (existingIndex >= 0) {
                    updatedData[existingIndex] = newReading;
                  } else {
                    updatedData.push(newReading);
                  }
                });
                return updatedData;
              });
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = () => {
          if (!isComponentMounted) return;
          console.log('WebSocket disconnected');
          setIsConnected(false);
          setWs(null);

          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            if (isComponentMounted) {
              console.log('Attempting to reconnect...');
              connectWebSocket();
            }
          }, 5000);
        };

        websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setIsConnected(false);

        // Retry connection after 5 seconds
        reconnectTimeout = setTimeout(() => {
          if (isComponentMounted) {
            connectWebSocket();
          }
        }, 5000);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      isComponentMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (websocket) {
        websocket.close();
      }
    };
  }, []); // Empty dependency array to run only once
  */

  // Use simulated connection status - properly implemented
  useEffect(() => {
    setIsConnected(true);
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
    
    try {
      // Get real-time Manila weather data from weather service
      const weatherData = await weatherService.getAllLocationsWeather();
      
      console.log('DataContext: Manila weather data received:', weatherData);
      
      if (weatherData && weatherData.length > 0) {
        // Convert Manila weather data to sensor data format
        const sensorData: SensorData[] = weatherData.map((weather: WeatherData) => ({
          _id: `manila_weather_${weather.deviceId}_${Date.now()}`,
          deviceId: weather.deviceId,
          temperature: weather.temperature,
          humidity: weather.humidity,
          moisture: weather.moisture,
          timestamp: weather.timestamp,
          status: weather.status,
          batteryLevel: weather.batteryLevel,
          signalStrength: weather.signalStrength,
        }));

        console.log('DataContext: Manila sensor data:', sensorData);
        
        setLatestSensorData(sensorData);
        setIsConnected(true);
        
        console.log(`DataContext: Updated with ${sensorData.length} Manila weather readings`);
      } else {
        console.log('DataContext: No Manila weather data received or empty array');
      }

      // Try to fetch alerts from backend (if available)
      try {
        const alertResponse = await alertService.getRecentAlerts(5);
        if (alertResponse.data.success && alertResponse.data.data) {
          setRecentAlerts(alertResponse.data.data);
        }
      } catch (alertError) {
        console.log('Could not fetch alerts from backend, using empty array');
        setRecentAlerts([]);
      }
      
    } catch (error) {
      console.error('Error fetching weather data:', error);
      setIsConnected(false);
      setLatestSensorData([]);
      setRecentAlerts([]);
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

  // Periodic data refresh - DISABLED AGAIN to stop refresh loop
  /*
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isCurrentlyLoading.current && !cooldownActive.current) {
        console.log('DataContext: Periodic refresh triggered');
        refreshData();
      }
    }, 300000); // Refresh every 5 minutes (300 seconds) for conservative updates

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // EMPTY dependency array to prevent loops
  */

  const value: DataContextType = {
    latestSensorData,
    recentAlerts,
    isConnected,
    isLoading,
    refreshData,
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
