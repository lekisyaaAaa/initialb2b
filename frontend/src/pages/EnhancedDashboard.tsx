import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../types';
import weatherService from '../services/weatherService';
import { 
  Leaf, 
  AlertTriangle, 
  Thermometer, 
  Droplets, 
  Sprout, 
  Battery,
  RefreshCw, 
  Settings, 
  LogIn,
  LogOut, 
  User,
  BarChart3,
  Activity,
  Wifi,
  WifiOff
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import ChartContainer from '../components/charts/ChartContainer';
import AlertSummaryChart from '../components/charts/AlertSummaryChart';
import DarkModeToggle from '../components/DarkModeToggle';

const EnhancedDashboard: React.FC = () => {
  const { recentAlerts, isConnected, isLoading, refreshData } = useData();
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'alerts' | 'sensors'>('overview');
  
  // Check if current user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Generate mock historical data for demonstration
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    // Generate sample historical data
    const generateWeatherData = async () => {
      try {
        console.log('EnhancedDashboard: Fetching historical weather data...');
        
        // Get historical pattern from weather service (24 hours of data)
        const historicalData = await weatherService.getHistoricalPattern(168); // Last 7 days
        
        if (historicalData && historicalData.length > 0) {
          console.log(`EnhancedDashboard: Retrieved ${historicalData.length} weather data points`);
          
          // Convert weather data to sensor data format
          const sensorData = historicalData.map((weather, index) => ({
            _id: `weather_${weather.deviceId}_${index}`,
            deviceId: weather.deviceId,
            temperature: weather.temperature,
            humidity: weather.humidity,
            moisture: weather.moisture,
            timestamp: weather.timestamp,
            status: weather.status,
            batteryLevel: weather.batteryLevel || 85,
            signalStrength: weather.signalStrength || -50,
          }));
          
          return sensorData;
        }
        
        // Fallback to minimal mock data if weather service fails
        console.warn('EnhancedDashboard: Weather service failed, using fallback data');
        return generateFallbackData();
        
      } catch (error) {
        console.error('EnhancedDashboard: Error fetching weather data:', error);
        return generateFallbackData();
      }
    };

    const generateFallbackData = () => {
      const data = [];
      const now = new Date();
      
      for (let i = 24; i >= 0; i--) { // Last 24 hours, hourly data
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
        const baseTemp = 27 + Math.sin((i / 12) * Math.PI) * 5; // Daily temperature cycle
        const baseHumidity = 70 + Math.sin((i / 8) * Math.PI) * 15; // Humidity cycle
        const baseMoisture = 45 + Math.sin((i / 16) * Math.PI) * 20; // Moisture cycle
        
        data.push({
          _id: `fallback_${i}`,
          deviceId: 'BEAN001',
          temperature: Math.round((baseTemp + (Math.random() - 0.5) * 4) * 10) / 10,
          humidity: Math.max(20, Math.min(95, Math.round(baseHumidity + (Math.random() - 0.5) * 10))),
          moisture: Math.max(10, Math.min(80, Math.round(baseMoisture + (Math.random() - 0.5) * 15))),
          timestamp: timestamp.toISOString(),
          status: Math.random() > 0.85 ? 'warning' : 'normal' as const,
          batteryLevel: Math.max(75, 100 - (i * 0.5) + (Math.random() - 0.5) * 10),
          signalStrength: Math.max(-70, -50 - Math.floor(Math.random() * 20)),
        });
      }
      
      return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    };

    const loadWeatherData = async () => {
      const weatherData = await generateWeatherData();
      setHistoricalData(weatherData);
    };

    loadWeatherData();
  }, []);

  // Calculate alert summary for pie chart
  const alertSummary = useMemo(() => {
    const summary = recentAlerts.reduce((acc: Record<string, number>, alert: Alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(summary).map(([severity, count]) => ({
      severity,
      count: count as number
    }));
  }, [recentAlerts]);

  // Get unique device IDs for filtering
  const deviceIds = useMemo(() => {
    const ids = new Set(historicalData.map(d => d.deviceId));
    return Array.from(ids);
  }, [historicalData]);

  // Latest readings for overview cards
  const latestReadings = useMemo(() => {
    if (historicalData.length === 0) return null;
    
    const latest = historicalData[historicalData.length - 1];
    return latest;
  }, [historicalData]);

  const getStatusColor = (status: string) => {
    switch (status) {
  case 'normal': return 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900';
  case 'warning': return 'text-secondary-600 bg-secondary-100 dark:text-secondary-300 dark:bg-secondary-900';
  case 'critical': return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900';
  default: return 'text-coffee-600 bg-coffee-100 dark:text-gray-200 dark:bg-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
  case 'low': return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900';
  case 'medium': return 'text-secondary-600 bg-secondary-100 dark:text-secondary-300 dark:bg-secondary-900';
  case 'high': return 'text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900';
  case 'critical': return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900';
  default: return 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    }
  };

  const unresolvedAlerts = recentAlerts.filter((alert: Alert) => !alert.isResolved);

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-50 to-coffee-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
  <header className="bg-white dark:bg-gray-900 shadow-lg border-b border-coffee-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link to="/" className="bg-coffee-600 dark:bg-coffee-700 rounded-lg p-2 mr-3 hover:bg-coffee-700 dark:hover:bg-coffee-800 transition-colors">
                <Leaf className="h-6 w-6 text-white" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-coffee-900 dark:text-white">BeanToBin Dashboard</h1>
                <p className="text-sm text-coffee-600 dark:text-gray-300">Environmental Monitoring System</p>
              </div>
            </div>

              <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center">
                {isConnected ? (
                  <Wifi className="w-5 h-5 text-green-400 dark:text-green-300 mr-2" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400 dark:text-red-300 mr-2" />
                )}
                <span className="text-sm text-coffee-600 dark:text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Dark Mode Toggle */}
              <DarkModeToggle />

              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="p-2 text-coffee-400 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* User Menu */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-coffee-600 dark:text-gray-200 mr-2" />
                    <span className="text-sm text-coffee-600 dark:text-gray-200">{user?.username}</span>
                    {isAdmin && (
                      <span className="ml-2 px-2 py-1 text-xs bg-coffee-200 dark:bg-gray-700 text-coffee-800 dark:text-gray-200 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 text-coffee-400 dark:text-gray-300 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center text-coffee-600 hover:text-coffee-800 transition-colors dark:text-gray-300 dark:hover:text-white"
                >
                  <LogIn className="h-5 w-5 mr-2" />
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
  <div className="bg-white dark:bg-gray-900 border-b border-coffee-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'charts', label: 'Data Visualization', icon: BarChart3 },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
              { id: 'sensors', label: 'Sensors', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-coffee-500 text-coffee-600 dark:text-white'
                      : 'border-transparent text-coffee-500 hover:text-coffee-700 hover:border-coffee-300 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Premium Glass Quick Stats */}
            {latestReadings && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch w-full">
                
                {/* Temperature Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 dark:from-red-900/40 dark:to-letran-900/40"></div>
                  <div className="relative bg-white/80 dark:bg-gray-800 backdrop-blur-lg border border-white/50 dark:border-gray-700 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-letran-500 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="bg-gradient-to-br from-red-100 to-red-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500 dark:bg-gray-700">
                        <Thermometer className="h-8 w-8 text-red-600 dark:text-red-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-coffee-600 dark:text-gray-300 mb-1">Temperature</p>
                        <p className="text-3xl font-bold text-coffee-900 dark:text-white group-hover:text-letran-600 transition-colors">
                          {latestReadings.temperature.toFixed(1)}°C
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Humidity Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-primary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 dark:from-blue-900/40 dark:to-primary-900/40"></div>
                  <div className="relative bg-white/80 dark:bg-gray-800 backdrop-blur-lg border border-white/50 dark:border-gray-700 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-primary-500 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500 dark:bg-gray-700">
                        <Droplets className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-coffee-600 dark:text-gray-300 mb-1">Humidity</p>
                        <p className="text-3xl font-bold text-coffee-900 dark:text-white group-hover:text-letran-600 transition-colors">
                          {latestReadings.humidity.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Moisture Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-success-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 dark:from-green-900/40 dark:to-success-900/40"></div>
                  <div className="relative bg-white/80 dark:bg-gray-800 backdrop-blur-lg border border-white/50 dark:border-gray-700 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-success-500 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500 dark:bg-gray-700">
                        <Sprout className="h-8 w-8 text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-coffee-600 dark:text-gray-300 mb-1">Moisture</p>
                        <p className="text-3xl font-bold text-coffee-900 dark:text-white group-hover:text-letran-600 transition-colors">
                          {latestReadings.moisture.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Battery Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary-500/20 to-secondary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500 dark:from-secondary-900/40 dark:to-secondary-900/40"></div>
                  <div className="relative bg-white/80 dark:bg-gray-800 backdrop-blur-lg border border-white/50 dark:border-gray-700 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary-500 to-secondary-500 rounded-t-2xl"></div>
                    <div className="flex items-center flex-1">
                      <div className="bg-gradient-to-br from-secondary-100 to-secondary-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500 dark:bg-gray-700">
                        <Battery className="h-8 w-8 text-secondary-600 dark:text-secondary-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-coffee-600 dark:text-gray-300 mb-1">Battery</p>
                        <p className="text-3xl font-bold text-coffee-900 dark:text-white group-hover:text-letran-600 transition-colors">
                          {latestReadings.batteryLevel?.toFixed(0) || 'N/A'}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Alerts & Quick Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Alerts */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700">
                <div className="p-6 border-b border-coffee-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-coffee-900 dark:text-white flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2 text-coffee-600 dark:text-gray-200" />
                    Recent Alerts ({unresolvedAlerts.length} unresolved)
                  </h3>
                </div>
                <div className="p-6">
                  {recentAlerts.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {recentAlerts.slice(0, 5).map((alert: Alert, index: number) => (
                        <div key={alert._id || index} className="flex items-start space-x-3 p-3 rounded-lg bg-coffee-50 dark:bg-gray-800">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-coffee-900 dark:text-white font-medium">{alert.message}</p>
                            <p className="text-xs text-coffee-600 dark:text-gray-300">
                              {format(new Date(alert.createdAt), 'MMM dd, HH:mm')} • {alert.deviceId}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-coffee-500 dark:text-gray-300 text-center py-8">No recent alerts</p>
                  )}
                </div>
              </div>

              {/* Alert Summary Chart */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700">
                <div className="p-6 border-b border-coffee-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-coffee-900 dark:text-white">Alert Distribution</h3>
                </div>
                <div className="p-6">
                  {alertSummary.length > 0 ? (
                    <AlertSummaryChart alerts={alertSummary} height={250} />
                  ) : (
                    <div className="flex items-center justify-center h-64 text-coffee-500">
                      <div className="text-center">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50 dark:text-gray-300" />
                        <p className="dark:text-gray-300">No alerts to display</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

    {activeTab === 'charts' && (
          <div className="space-y-8">
            <div className="text-center">
      <h2 className="text-2xl font-bold text-coffee-900 dark:text-white mb-2">Data Visualization</h2>
      <p className="text-coffee-600 dark:text-gray-300">Interactive charts showing environmental sensor data over time</p>
            </div>

            {/* Main Chart */}
            <ChartContainer 
              data={historicalData} 
              title="Environmental Data Overview"
            />

            {/* Device-specific Charts */}
            {deviceIds.map(deviceId => (
              <ChartContainer
                key={deviceId}
                data={historicalData}
                title={`Device ${deviceId} - Detailed View`}
                deviceId={deviceId}
              />
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700">
              <div className="p-6 border-b border-coffee-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-coffee-900 dark:text-white">All Alerts</h3>
              </div>
              <div className="p-6">
                {recentAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {recentAlerts.map((alert: Alert, index: number) => (
                      <div key={alert._id || index} className="border border-coffee-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(alert.severity)}`}>
                              {alert.severity.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-coffee-900 dark:text-white font-medium">{alert.message}</p>
                              <p className="text-coffee-600 dark:text-gray-300 text-sm mt-1">
                                {format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm:ss')} • Device: {alert.deviceId}
                              </p>
                              {alert.isResolved && alert.resolvedAt && (
                                <p className="text-green-600 dark:text-green-300 text-sm mt-1">
                                  Resolved: {format(new Date(alert.resolvedAt), 'MMM dd, yyyy HH:mm:ss')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs ${
                            alert.isResolved 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {alert.isResolved ? 'Resolved' : 'Open'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 text-coffee-300 dark:text-gray-300 mx-auto mb-4" />
                    <p className="text-coffee-500 dark:text-gray-300">No alerts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sensors' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deviceIds.map(deviceId => {
                const deviceData = historicalData.filter(d => d.deviceId === deviceId);
                const latestData = deviceData[deviceData.length - 1];
                
                return (
                  <div key={deviceId} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-coffee-900 dark:text-white">{deviceId}</h3>
                        <div className={`px-3 py-1 rounded-full text-sm ${getStatusColor(latestData?.status || 'unknown')}`}>
                          {latestData?.status || 'Unknown'}
                        </div>
                      </div>
                    
                    {latestData && (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-coffee-600 dark:text-gray-300">Temperature:</span>
                          <span className="font-medium text-coffee-900 dark:text-white">{latestData.temperature.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-coffee-600 dark:text-gray-300">Humidity:</span>
                          <span className="font-medium text-coffee-900 dark:text-white">{latestData.humidity.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-coffee-600 dark:text-gray-300">Moisture:</span>
                          <span className="font-medium text-coffee-900 dark:text-white">{latestData.moisture.toFixed(1)}%</span>
                        </div>
                        {latestData.batteryLevel && (
                          <div className="flex justify-between">
                            <span className="text-coffee-600 dark:text-gray-300">Battery:</span>
                              <span className="font-medium text-coffee-900 dark:text-white">{latestData.batteryLevel.toFixed(0)}%</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-coffee-600 dark:text-gray-300">Last Update:</span>
                          <span className="font-medium text-sm text-coffee-900 dark:text-white">
                            {format(new Date(latestData.timestamp), 'HH:mm:ss')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EnhancedDashboard;
