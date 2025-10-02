import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SensorData, Alert } from '../types';
import { Leaf, AlertTriangle, Thermometer, Droplets, Sprout, Battery, RefreshCw, Settings, TrendingUp, LogOut, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import DarkModeToggle from '../components/DarkModeToggle';
import Hero from '../components/ui/Hero';
import SensorCard from '../components/ui/SensorCard';
import AlertsPanel from '../components/ui/AlertsPanel';
// ...existing code...
import SmartTips from '../components/ui/SmartTips';
import Graphs from '../components/ui/Graphs';
import ErrorBanner from '../components/ui/ErrorBanner';
import weatherService from '../services/weatherService';

// Top-level WebSocketStatus component (uses hooks at top level)
const WebSocketStatus: React.FC = () => {
  const { isConnected, lastFetchCount, lastFetchAt } = useData();
  return (
    <div className="text-sm text-espresso-600 dark:text-gray-300 text-right">
      <div>WS: {isConnected ? <span className="text-success-500">Connected</span> : <span className="text-danger-500">Disconnected</span>}</div>
      <div className="text-xs">Last fetch: {lastFetchCount} @ {lastFetchAt ? new Date(lastFetchAt).toLocaleTimeString() : '—'}</div>
    </div>
  );
};

interface DashboardProps {
  // No props needed - role checking via AuthContext
}

const Dashboard: React.FC<DashboardProps> = () => {
  const { latestSensorData, recentAlerts, isConnected, isLoading, refreshData } = useData();
  const { lastFetchError, clearLastFetchError } = useData();
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'sensors' | 'settings'>('overview');
  // ...existing code...
  
  // Check if current user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Debug: Log dashboard access
  useEffect(() => {
    console.log('Dashboard: Component mounted - Public access enabled');
    console.log('Dashboard: Authentication status:', { isAuthenticated, isAdmin, user: user?.username || 'None' });
  }, [isAuthenticated, isAdmin, user]);

  
  
  // Store refreshData in a ref to prevent re-renders from affecting the interval
  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;

  const [manilaSummary, setManilaSummary] = React.useState<any | null>(null);
  // compute latest pH reading from the DataContext-provided latestSensorData
  const latestPh = React.useMemo(() => {
    if (!Array.isArray(latestSensorData) || latestSensorData.length === 0) return null;
    for (let i = latestSensorData.length - 1; i >= 0; i--) {
      const d = latestSensorData[i] as any;
      if (typeof d.ph === 'number') return d.ph;
    }
    const phVals = latestSensorData.map((d: any) => d.ph).filter((v: any) => typeof v === 'number');
    if (phVals.length === 0) return null;
    return phVals.reduce((s: number, v: number) => s + v, 0) / phVals.length;
  }, [latestSensorData]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sum = await weatherService.getManilaWeatherSummary();
        if (mounted) setManilaSummary(sum);
      } catch (err) {
        console.warn('Dashboard: failed fetching Manila summary', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  // status color helper removed from this file (defined where needed in specific pages)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-100';
  case 'medium': return 'text-secondary-600 bg-secondary-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Guard against undefined/null data coming from the backend
  const safeLatestSensorData: SensorData[] = Array.isArray(latestSensorData) ? latestSensorData : [];
  const safeRecentAlerts: Alert[] = Array.isArray(recentAlerts) ? recentAlerts : [];

  const unresolvedAlerts = safeRecentAlerts.filter((alert: Alert) => !alert.isResolved);

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
  {/* noop: rebuild trigger for CSS changes */}
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

              {/* WebSocket status + last fetch */}
              <WebSocketStatus />

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
                className="panel-button panel-button--primary"
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
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={logout}
                        className="p-2 text-espresso-400 hover:text-danger-600 transition-colors"
                        title="Logout"
                      >
                        <LogOut className="h-5 w-5" />
                      </button>
                    </div>
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
                      <Link to="/admin/login" className="letran-button">
                        <ArrowRight className="h-4 w-4" />
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

      {/* Error banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <ErrorBanner message={lastFetchError} onClose={clearLastFetchError} />
      </div>

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
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

            {/* Compact admin-only control on the nav bar */}
            <div>
              {isAdmin && (
                <button
                  id="btn-home-assistant"
                  aria-label="Open SmartBin Console"
                  onClick={() => { window.location.href = '/home-assistant'; }}
                  className="ml-4 panel-button panel-button--primary"
                  title="SmartBin Console"
                >
                  SmartBin Console
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Hero />
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Premium Glass Quick Stats */}
            {safeLatestSensorData.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6 items-stretch w-full">
                
                {/* Temperature Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-letran-500 rounded-t-2xl"></div>

                      <div className="flex items-center mb-4">
                        <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-red-100 to-red-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                          <Thermometer className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600">Temperature</p></div>
                          <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">{safeLatestSensorData.length > 0 ? (safeLatestSensorData[safeLatestSensorData.length - 1].temperature || 0).toFixed(1) : '—'}°C</p>
                        </div>
                      </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Humidity Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-primary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-primary-500 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-blue-100 to-blue-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-blue-600" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600">Humidity</p></div>
                          <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">{safeLatestSensorData.length > 0 ? (safeLatestSensorData[safeLatestSensorData.length - 1].humidity || 0).toFixed(1) : '—'}%</p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* pH Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-amber-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-amber-100 to-amber-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-amber-600" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600">pH</p></div>
                          <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">{latestPh !== null ? latestPh.toFixed(2) : '—'}</p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Battery Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary-500/20 to-secondary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary-500 to-secondary-500 rounded-t-2xl"></div>
                    <div className="flex items-center flex-1">
                      <div className="bg-gradient-to-br from-secondary-100 to-secondary-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Battery className="h-8 w-8 text-secondary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-espresso-600 mb-1">Battery</p>
                        <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">
                          {safeLatestSensorData.length > 0 ? (safeLatestSensorData[safeLatestSensorData.length - 1].batteryLevel || 0).toFixed(0) : '—'}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EC Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-purple-100 to-purple-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-purple-600" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600">EC</p></div>
                          <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">{safeLatestSensorData.length > 0 && (safeLatestSensorData[safeLatestSensorData.length - 1] as any).ec ? ((safeLatestSensorData[safeLatestSensorData.length - 1] as any).ec).toFixed(2) : '—'} mS/cm</p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* NPK Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-green-100 to-green-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Sprout className="h-6 w-6 text-green-600" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600">NPK</p></div>
                          <div className="text-sm text-espresso-900">
                            <div>N: {safeLatestSensorData.length > 0 && (safeLatestSensorData[safeLatestSensorData.length - 1] as any).nitrogen ? ((safeLatestSensorData[safeLatestSensorData.length - 1] as any).nitrogen).toFixed(0) : '—'}</div>
                            <div>P: {safeLatestSensorData.length > 0 && (safeLatestSensorData[safeLatestSensorData.length - 1] as any).phosphorus ? ((safeLatestSensorData[safeLatestSensorData.length - 1] as any).phosphorus).toFixed(0) : '—'}</div>
                            <div>K: {safeLatestSensorData.length > 0 && (safeLatestSensorData[safeLatestSensorData.length - 1] as any).potassium ? ((safeLatestSensorData[safeLatestSensorData.length - 1] as any).potassium).toFixed(0) : '—'}</div>
                          </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Water Level Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-cyan-100 to-cyan-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-cyan-600" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600">Water Level</p></div>
                          <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">
                            {safeLatestSensorData.length > 0 && (safeLatestSensorData[safeLatestSensorData.length - 1] as any).waterLevel !== undefined ? ((safeLatestSensorData[safeLatestSensorData.length - 1] as any).waterLevel === 1 ? 'Present' : 'Low') : '—'}
                          </p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Active Devices Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-letran-500 rounded-t-2xl"></div>
                    <div className="flex items-center flex-1">
                      <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Thermometer className="h-8 w-8 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-espresso-600 mb-1">Active Devices</p>
                        <p className="text-3xl font-bold text-espresso-900 group-hover:text-letran-600 transition-colors">{safeLatestSensorData.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manila Weather Snapshot (if loaded) */}
            {manilaSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="group relative overflow-hidden h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                  <div className="relative bg-white/80 backdrop-blur-lg border border-white/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-t-2xl"></div>
                    <div className="mb-2">
                      <p className="text-sm font-medium text-espresso-600">Manila Weather (avg)</p>
                    </div>
                    <div className="flex items-center flex-1">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-100 to-orange-50 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Thermometer className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div className="ml-4 flex items-center justify-center flex-1 min-h-[72px]">
                        <p className="text-3xl font-bold text-espresso-900">{manilaSummary.averageTemp}°C • {manilaSummary.averageHumidity}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Latest Sensor Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeLatestSensorData.length === 0 ? (
                <div className="col-span-full p-6 admin-empty-card rounded-lg text-center text-gray-500">
                  <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  No sensor data available — click "Load Weather" to fetch data
                </div>
              ) : (
                safeLatestSensorData.slice(0, 9).map((d: SensorData, idx: number) => (
                  <SensorCard key={(d as any).id || d.deviceId || `sensor-${idx}`} data={d} />
                ))
              )}
            </div>

            {/* Graphs + Alerts + Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Graphs data={latestSensorData as any} />
              </div>
              <div className="lg:col-span-1 space-y-4">
                <AlertsPanel alerts={recentAlerts} />
                <SmartTips />
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Alerts</h3>
              </div>
              <div className="p-6">
                {safeRecentAlerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No recent alerts
                  </div>
                ) : (
                  <div className="space-y-3">
                    {safeRecentAlerts.slice(0, 5).map((alert: Alert, idx: number) => (
                      <div key={(alert as any).id || alert._id || `${alert.deviceId || 'alert'}-${idx}`} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor((alert.severity || 'info') as string)}`}>
                            {(alert.severity || 'info').toString().toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{alert.message}</p>
                            <p className="text-sm text-gray-500">{alert.deviceId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {format(new Date(alert.createdAt || Date.now()), 'MMM dd, HH:mm')}
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
