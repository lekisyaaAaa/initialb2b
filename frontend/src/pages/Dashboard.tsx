import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SensorData, Alert } from '../types';
import { Leaf, AlertTriangle, Thermometer, Droplets, Sprout, Battery, RefreshCw, Settings, TrendingUp, LogIn, LogOut, User } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import DarkModeToggle from '../components/DarkModeToggle';
import { useDarkMode } from '../contexts/DarkModeContext';

interface DashboardProps {
  // No props needed - role checking via AuthContext
}

const Dashboard: React.FC<DashboardProps> = () => {
  const { latestSensorData, recentAlerts, isConnected, isLoading, refreshData } = useData();
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'sensors' | 'settings'>('overview');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  // Check if current user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Ensure admin dashboard uses dark mode by default, but only once on initial mount.
  const { isDarkMode, toggleDarkMode, setDarkMode } = useDarkMode();
  const adminDarkSetRef = useRef(false);
  useEffect(() => {
    // Only auto-enable dark mode for admins on first detection to avoid overriding user toggles.
    if (isAdmin && !isDarkMode && !adminDarkSetRef.current) {
      setDarkMode(true);
      adminDarkSetRef.current = true;
    }
  }, [isAdmin, isDarkMode, setDarkMode]);

  // Debug: Log dashboard access
  useEffect(() => {
    console.log('Dashboard: Component mounted - Public access enabled');
    console.log('Dashboard: Authentication status:', { isAuthenticated, isAdmin, user: user?.username || 'None' });
  }, [isAuthenticated, isAdmin, user]);
  
  // Store refreshData in a ref to prevent re-renders from affecting the interval
  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;

  // REMOVED: One-time data load to prevent refresh loops
  // Users can manually click "Load Weather" button to get data

  // Auto-refresh data with SAFE implementation - prevents loops
  useEffect(() => {
    // SAFE AUTO-REFRESH: Only enable if explicitly needed and with long intervals
    const REFRESH_INTERVAL = 600000; // 10 minutes - very conservative
    const ENABLE_AUTO_REFRESH = false; // Disabled by default to prevent loops
    
    if (!ENABLE_AUTO_REFRESH) {
      console.log('Dashboard: Auto-refresh disabled for stability');
      return;
    }

    console.log('Dashboard: Setting up auto-refresh interval');
    const interval = setInterval(() => {
      console.log('Dashboard: Auto-refresh triggered');
      if (refreshDataRef.current) {
        refreshDataRef.current();
      }
    }, REFRESH_INTERVAL);

    return () => {
      console.log('Dashboard: Cleaning up auto-refresh interval');
      clearInterval(interval);
    };
  }, []); // Empty dependency array - no dependencies to prevent loops

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-success-600 bg-success-100';
      case 'warning': return 'text-warning-600 bg-warning-100';
      case 'critical': return 'text-danger-600 bg-danger-100';
      default: return 'text-coffee-600 bg-coffee-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const unresolvedAlerts = recentAlerts.filter((alert: Alert) => !alert.isResolved);

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg border-b border-coffee-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link to="/" className="bg-primary-600 dark:bg-primary-500 rounded-lg p-2 mr-3 hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors">
                <Leaf className="h-6 w-6 text-white" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-espresso-900 dark:text-white">BeanToBin</h1>
                <p className="text-sm text-espresso-600 dark:text-gray-300">
                  Environmental Monitoring Dashboard 
                  {!isAuthenticated && <span className="text-primary-600 dark:text-primary-400 font-medium"> (Public Access)</span>}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                <span className="text-sm text-espresso-600 dark:text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Dark Mode Toggle */}
              <DarkModeToggle />

              {/* Refresh Button */}
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="p-2 text-espresso-400 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Manual Weather Load Button - For Testing */}
              <button
                onClick={() => {
                  console.log('Manual weather load clicked');
                  refreshData();
                }}
                className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
                title="Load Weather Data"
              >
                Load Weather
              </button>

              {/* System Status & Auth */}
              <div className="flex items-center space-x-2">
                {isAdmin ? (
                  // Admin mode - show user info and logout
                  <>
                    <div className="text-right">
                      <p className="text-sm font-medium text-espresso-900">
                        <User className="inline h-4 w-4 mr-1" />
                        {user?.username}
                      </p>
                      <p className="text-xs text-espresso-600">
                        {user?.role} - Admin Dashboard
                      </p>
                    </div>
                    {/* Home Assistant button - admin only */}
                    <Link
                      to="/admin/home-assistant"
                      className="ml-3 px-3 py-1 bg-letran-600 text-white rounded-md hover:bg-letran-700 transition-colors text-sm"
                      title="Open Home Assistant integration page"
                    >
                      Home Assistant
                    </Link>
                    <button
                      onClick={logout}
                      className="p-2 text-espresso-400 hover:text-danger-600 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  // Public mode - show login link or regular user info
                  <>
                    <div className="text-right">
                      {isAuthenticated ? (
                        <>
                          <p className="text-sm font-medium text-espresso-900">
                            <User className="inline h-4 w-4 mr-1" />
                            {user?.username}
                          </p>
                          <p className="text-xs text-espresso-600">
                            {user?.role} - Limited Access
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-espresso-900">Environmental Monitor</p>
                          <p className="text-xs text-espresso-600">Public Dashboard</p>
                        </>
                      )}
                    </div>
                    {isAuthenticated ? (
                      <button
                        onClick={logout}
                        className="p-2 text-espresso-400 hover:text-danger-600 transition-colors"
                        title="Logout"
                      >
                        <LogOut className="h-5 w-5" />
                      </button>
                    ) : (
                      <Link
                        to="/admin/login"
                        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-espresso-700 hover:text-primary-600 border border-coffee-300 rounded-md hover:border-primary-300 transition-colors"
                      >
                        <LogIn className="h-4 w-4" />
                        <span>Admin Login</span>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
              { id: 'sensors', label: 'Sensors', icon: Thermometer },
              ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: Settings }] : [])
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-espresso-500 hover:text-espresso-700 hover:border-coffee-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
                {id === 'alerts' && unresolvedAlerts.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 text-xs rounded-full px-2 py-1">
                    {unresolvedAlerts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Premium Glass Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Active Devices Card */}
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-letran-500 rounded-t-2xl"></div>
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Thermometer className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-espresso-600 mb-1">Active Devices</p>
                      <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">
                        {latestSensorData.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Alerts Card */}
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-letran-500 rounded-t-2xl"></div>
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-red-100 to-red-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-espresso-600 mb-1">Active Alerts</p>
                      <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">
                        {unresolvedAlerts.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Average Humidity Card */}
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-coffee-500/20 to-primary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-coffee-500 to-primary-500 rounded-t-2xl"></div>
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-coffee-200 to-coffee-100 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Droplets className="h-8 w-8 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-espresso-600 mb-1">Avg Humidity</p>
                      <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">
                        {latestSensorData.length > 0
                          ? Math.round(latestSensorData.reduce((sum: number, d: SensorData) => sum + d.humidity, 0) / latestSensorData.length)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Average Moisture Card */}
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-warning-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-warning-500 rounded-t-2xl"></div>
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Sprout className="h-8 w-8 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-espresso-600 mb-1">Avg Moisture</p>
                      <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">
                        {latestSensorData.length > 0
                          ? Math.round(latestSensorData.reduce((sum: number, d: SensorData) => sum + d.moisture, 0) / latestSensorData.length)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Manila Sensor Data (white container with dark rows) */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-medium text-gray-900">Latest Manila Weather Readings</h3>
                <p className="text-sm text-gray-500 mt-1">Real-time environmental data from Manila Metro Area</p>
              </div>
              <div className="p-6">
                {latestSensorData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="mb-4">
                      <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    </div>
                    <p>No Manila weather data available</p>
                    <p className="text-xs mt-2">Click "Load Weather" to fetch real-time Manila data</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {latestSensorData.slice(0, 5).map((data: SensorData) => (
                      <div key={data._id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg text-white">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(data.status).replace('text-', 'bg-').replace('bg-', 'bg-')}`}></div>
                          </div>
                          <div>
                            <p className="font-medium text-white">{data.deviceId}</p>
                            <p className="text-sm text-gray-300">
                              Manila • {format(new Date(data.timestamp), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <p className="text-gray-300">Temp</p>
                            <p className="font-medium">{data.temperature}°C</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300">Humidity</p>
                            <p className="font-medium">{data.humidity}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-300">Moisture</p>
                            <p className="font-medium">{data.moisture}%</p>
                          </div>
                          {data.batteryLevel && (
                            <div className="text-center">
                              <p className="text-gray-300">Battery</p>
                              <div className="flex items-center">
                                <Battery className="h-4 w-4 mr-1 text-white" />
                                <span className="font-medium">{data.batteryLevel}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Alerts</h3>
              </div>
              <div className="p-6">
                {recentAlerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No recent alerts
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentAlerts.slice(0, 5).map((alert: Alert) => (
                      <div key={alert._id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{alert.message}</p>
                            <p className="text-sm text-gray-500">{alert.deviceId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {format(new Date(alert.createdAt), 'MMM dd, HH:mm')}
                          </p>
                          {alert.isResolved && (
                            <span className="text-xs text-green-600">Resolved</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="text-center py-16">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Alerts Management</h3>
            <p className="text-gray-500">Detailed alerts view coming soon...</p>
          </div>
        )}

        {activeTab === 'sensors' && (
          <div className="text-center py-16">
            <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sensor Management</h3>
            <p className="text-gray-500">Detailed sensor view coming soon...</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="text-center py-16">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">System Settings</h3>
            <p className="text-gray-500">Settings configuration coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
