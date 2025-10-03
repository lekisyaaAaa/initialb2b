/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Alert } from '../types';
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
  WifiOff,
  Shield,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import ChartContainer from '../components/charts/ChartContainer';
import AlertSummaryChart from '../components/charts/AlertSummaryChart';
import DarkModeToggle from '../components/DarkModeToggle';

// Mock sensor data for demonstration
const mockSensorData = [
  {
    id: 1,
    deviceId: 'ESP32-001',
    temperature: 28.5,
    humidity: 65.2,
    ph: 6.8,
    ec: 1.2,
    nitrogen: 45,
    phosphorus: 12,
    potassium: 78,
    moisture: 42.3,
    waterLevel: 1,
    batteryLevel: 85,
    status: 'normal',
    timestamp: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
  },
  {
    id: 2,
    deviceId: 'ESP32-002',
    temperature: 27.8,
    humidity: 68.1,
    ph: 7.2,
    ec: 0.9,
    nitrogen: 52,
    phosphorus: 15,
    potassium: 82,
    moisture: 38.7,
    waterLevel: 1,
    batteryLevel: 92,
    status: 'normal',
    timestamp: new Date(Date.now() - 240000).toISOString() // 4 minutes ago
  },
  {
    id: 3,
    deviceId: 'ESP32-003',
    temperature: 29.2,
    humidity: 62.8,
    ph: 6.5,
    ec: 1.5,
    nitrogen: 38,
    phosphorus: 9,
    potassium: 65,
    moisture: 45.1,
    waterLevel: 0,
    batteryLevel: 78,
    status: 'warning',
    timestamp: new Date(Date.now() - 180000).toISOString() // 3 minutes ago
  },
  {
    id: 4,
    deviceId: 'ESP32-004',
    temperature: 26.9,
    humidity: 71.3,
    ph: 7.0,
    ec: 1.1,
    nitrogen: 48,
    phosphorus: 14,
    potassium: 75,
    moisture: 41.8,
    waterLevel: 1,
    batteryLevel: 88,
    status: 'normal',
    timestamp: new Date(Date.now() - 120000).toISOString() // 2 minutes ago
  }
];

// Mock alerts for demonstration
const mockAlerts: Alert[] = [
  {
    _id: 'mock-1',
    message: 'Temperature reading above normal range',
    severity: 'medium',
    deviceId: 'ESP32-003',
    createdAt: new Date(Date.now() - 180000).toISOString(),
    isResolved: false
  },
  {
    _id: 'mock-2',
    message: 'Low water level detected',
    severity: 'high',
    deviceId: 'ESP32-003',
    createdAt: new Date(Date.now() - 150000).toISOString(),
    isResolved: false
  },
  {
    _id: 'mock-3',
    message: 'Battery level low on ESP32-003',
    severity: 'low',
    deviceId: 'ESP32-003',
    createdAt: new Date(Date.now() - 120000).toISOString(),
    isResolved: true,
    resolvedAt: new Date(Date.now() - 60000).toISOString()
  }
];

const MockDashboard: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'alerts' | 'sensors'>('overview');

  // Check if current user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Use mock data instead of real sensor data
  const safeLatestSensorData = useMemo(() => mockSensorData, []);

  // Calculate alert summary for pie chart
  const alertSummary = useMemo(() => {
    const summary = mockAlerts.reduce((acc: Record<string, number>, alert: Alert) => {
      const sev = (alert.severity || 'unknown').toString();
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(summary).map(([severity, count]) => ({
      severity,
      count: count as number
    }));
  }, []);

  // Get unique device IDs for filtering
  const deviceIds = useMemo(() => {
    const ids = new Set(safeLatestSensorData.map(d => d.deviceId));
    return Array.from(ids);
  }, [safeLatestSensorData]);

  // Latest readings for overview cards
  const latestReadings = useMemo(() => {
    if (safeLatestSensorData.length === 0) return null;

    const latest = safeLatestSensorData[safeLatestSensorData.length - 1];
    return latest;
  }, [safeLatestSensorData]);

  // derive a latest pH from sensorData
  const latestPh = useMemo(() => {
    const arr = safeLatestSensorData.slice().reverse();
    for (const d of arr) {
      if (typeof d.ph === 'number') return d.ph;
    }
    return null;
  }, [safeLatestSensorData]);

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

  const unresolvedAlerts = mockAlerts.filter((alert: Alert) => !alert.isResolved);

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
      {/* Enhanced Header with Modern Design */}
      <header className="bg-gradient-to-r from-white via-coffee-50 to-white dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 shadow-xl border-b border-coffee-200/50 dark:border-gray-700/50 backdrop-blur-sm bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            {/* Brand Section */}
            <div className="flex items-center space-x-4">
              {/* Enhanced Logo */}
              <Link to="/" className="group relative">
                <div className="letran-coffee-gradient rounded-xl p-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group-hover:rotate-3">
                  <Leaf className="h-7 w-7 text-white drop-shadow-sm" />
                </div>
              </Link>

              {/* Brand Text */}
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <h1 className="site-title dark:site-title text-2xl font-bold">
                    Bean<span className="site-accent bg-gradient-to-r from-teal-500 to-purple-600 bg-clip-text text-transparent">To</span>Bin
                  </h1>
                  <div className="hidden sm:flex items-center space-x-1">
                    <div className="live-indicator">
                      <div className="pulse-dot"></div>
                      <span>Demo</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-1">
                  <p className="site-subtitle text-sm font-medium">
                    Mock Environmental Monitoring System
                  </p>
                  <div className="site-badge bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 shadow-sm">
                    <Activity className="w-3 h-3" />
                    <span>Mock Data</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Controls */}
            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className="hidden md:flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Mock Data Active</span>
              </div>

              {/* Quick Stats */}
              <div className="hidden lg:flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  <span className="font-medium">Mock Sensors</span>
                </div>
                <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                  <Activity className="w-4 h-4 text-teal-500" />
                  <span className="font-medium">Demo Mode</span>
                </div>
              </div>

              {/* Dark Mode Toggle */}
              <div className="flex items-center">
                <DarkModeToggle />
              </div>

              {/* Refresh Button */}
              <button
                className="p-2 text-coffee-400 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-gray-200 cursor-not-allowed opacity-50"
                disabled
                title="Mock data - refresh disabled"
              >
                <RefreshCw className="h-5 w-5" />
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

        {/* Subtle accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-teal-300 dark:via-teal-600 to-transparent opacity-50"></div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'charts', label: 'Data Visualization', icon: BarChart3 },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
              { id: 'sensors', label: 'Sensors', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as 'overview' | 'charts' | 'alerts' | 'sensors')}
                className={`flex items-center space-x-2 px-4 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Premium Glass Quick Stats */}
            {latestReadings && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch w-full">

                {/* Temperature Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-letran-500 rounded-t-2xl"></div>

                      <div className="flex items-center mb-4">
                        <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-800 dark:to-red-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                          <Thermometer className="h-6 w-6 text-red-600 dark:text-red-300" />
                        </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Temperature</p></div>
                          <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{latestReadings?.temperature ? latestReadings.temperature.toFixed(1) : '—'}°C</p>
                        </div>
                      </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Humidity Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-primary-500 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-800 dark:to-blue-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Humidity</p></div>
                          <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{latestReadings?.humidity ? latestReadings.humidity.toFixed(1) : '—'}%</p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* pH Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-800 dark:to-amber-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">pH</p></div>
                          <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{latestReadings?.ph && !Number.isNaN(latestReadings.ph) ? latestReadings.ph.toFixed(2) : '—'}</p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* Battery Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary-500 to-secondary-500 rounded-t-2xl"></div>
                    <div className="flex items-center flex-1">
                      <div className="bg-gradient-to-br from-secondary-100 to-secondary-50 dark:from-secondary-800 dark:to-secondary-700 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Battery className="h-8 w-8 text-secondary-600 dark:text-secondary-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-espresso-600 dark:text-gray-300 mb-1">Battery</p>
                        <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                          {latestReadings.batteryLevel?.toFixed(0) || 'N/A'}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* EC Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-800 dark:to-purple-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">EC</p></div>
                          <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{latestReadings?.ec && !Number.isNaN(latestReadings.ec) ? latestReadings.ec.toFixed(2) : '—'} mS/cm</p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
                  </div>
                </div>

                {/* NPK Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-400 rounded-t-2xl"></div>

                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="flex items-center mb-4">
                        <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-800 dark:to-green-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                          <Sprout className="h-6 w-6 text-green-600 dark:text-green-300" />
                        </div>
                          <div className="flex flex-col justify-center flex-1">
                            <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">NPK</p></div>
                            <div className="text-sm text-espresso-900 dark:text-white">
                              <div>N: {latestReadings?.nitrogen && !Number.isNaN(latestReadings.nitrogen) ? latestReadings.nitrogen.toFixed(0) : '—'}</div>
                              <div>P: {latestReadings?.phosphorus && !Number.isNaN(latestReadings.phosphorus) ? latestReadings.phosphorus.toFixed(0) : '—'}</div>
                              <div>K: {latestReadings?.potassium && !Number.isNaN(latestReadings.potassium) ? latestReadings.potassium.toFixed(0) : '—'}</div>
                            </div>
                          </div>
                      </div>

                      <div className="flex-1 min-h-[140px]"></div>
                    </div>
                  </div>
                </div>

                {/* Water Level Card */}
                <div className="group relative overflow-hidden h-full">
                  <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-t-2xl"></div>

                    <div className="flex items-center mb-4">
                      <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-800 dark:to-cyan-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                        <Droplets className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                      </div>
                        <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                          <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Water Level</p></div>
                          <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                            {(latestReadings.waterLevel ?? null) !== null ? (latestReadings.waterLevel === 1 ? 'Present' : 'Low') : '—'}
                          </p>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[140px]"></div>
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
                  {mockAlerts.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {mockAlerts.slice(0, 5).map((alert: Alert, index: number) => (
                        <div key={alert._id || index} className="flex items-start space-x-3 p-3 rounded-lg bg-coffee-50 dark:bg-gray-800">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor((alert.severity || 'info') as string)}`}>
                            {(alert.severity || 'info').toString().toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-coffee-900 dark:text-white font-medium">{alert.message}</p>
                            <p className="text-xs text-coffee-600 dark:text-gray-300">
                              {format(new Date(alert.createdAt || Date.now()), 'MMM dd, HH:mm')} • {alert.deviceId}
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
              data={safeLatestSensorData}
              title="Current Environmental Data"
            />

            {/* Device-specific Charts */}
            {deviceIds.map(deviceId => (
              <ChartContainer
                key={deviceId}
                data={safeLatestSensorData.filter(d => d.deviceId === deviceId)}
                title={`Device ${deviceId} - Current Readings`}
                deviceId={deviceId}
              />
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Admin Alert Notification */}
            {unresolvedAlerts.length > 0 && user?.role === 'admin' && (
              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl shadow-lg border border-red-600">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Shield className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Admin Alert: {unresolvedAlerts.length} Active Alert{unresolvedAlerts.length !== 1 ? 's' : ''}</h3>
                        <p className="text-red-100 mt-1">
                          There {unresolvedAlerts.length === 1 ? 'is' : 'are'} {unresolvedAlerts.length} unresolved alert{unresolvedAlerts.length !== 1 ? 's' : ''} requiring your attention.
                          Please review and take appropriate action in the admin dashboard.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/admin/dashboard"
                      className="flex items-center space-x-2 bg-white text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Go to Admin Dashboard</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700">
              <div className="p-6 border-b border-coffee-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-coffee-900 dark:text-white">All Alerts</h3>
              </div>
              <div className="p-6">
                {mockAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {mockAlerts.map((alert: Alert, index: number) => (
                      <div key={alert._id || index} className="border border-coffee-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor((alert.severity || 'info') as string)}`}>
                              {(alert.severity || 'info').toString().toUpperCase()}
                            </div>
                            <div>
                              <p className="text-coffee-900 dark:text-white font-medium">{alert.message}</p>
                              <p className="text-coffee-600 dark:text-gray-300 text-sm mt-1">
                                {format(new Date(alert.createdAt || Date.now()), 'MMM dd, yyyy HH:mm:ss')} • Device: {alert.deviceId}
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
            <div className="text-center">
              <h2 className="text-2xl font-bold text-coffee-900 dark:text-white mb-2">Sensor Devices</h2>
              <p className="text-coffee-600 dark:text-gray-300">Real-time status and readings from all connected sensors</p>
            </div>

            <div className="grid grid-cols-4 gap-6">
              {deviceIds.length > 0 ? deviceIds.map(deviceId => {
                const deviceData = safeLatestSensorData.filter(d => d.deviceId === deviceId);
                const latestData = deviceData[deviceData.length - 1];

                return (
          <div key={deviceId} className="group relative overflow-hidden h-full">
            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-teal-500 rounded-t-2xl"></div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-800 dark:to-blue-700 shadow-lg">
                            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                          </div>
                          <h3 className="text-lg font-semibold text-espresso-900 dark:text-white">{deviceId}</h3>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(latestData?.status || 'unknown')}`}>
                          {latestData?.status || 'Unknown'}
                        </div>
                      </div>

                      {latestData && (
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-red-50 to-red-25 dark:from-red-900/20 dark:to-red-800/20">
                            <div className="flex items-center space-x-2">
                              <Thermometer className="h-4 w-4 text-red-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Temperature</span>
                            </div>
                            <span className="font-bold text-espresso-900 dark:text-white">{latestData?.temperature ? latestData.temperature.toFixed(1) : '—'}°C</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-25 dark:from-blue-900/20 dark:to-blue-800/20">
                            <div className="flex items-center space-x-2">
                              <Droplets className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Humidity</span>
                            </div>
                            <span className="font-bold text-espresso-900 dark:text-white">{latestData?.humidity ? latestData.humidity.toFixed(1) : '—'}%</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-25 dark:from-green-900/20 dark:to-green-800/20">
                            <div className="flex items-center space-x-2">
                              <Sprout className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Moisture</span>
                            </div>
                            <span className="font-bold text-espresso-900 dark:text-white">{latestData?.moisture ? latestData.moisture.toFixed(1) : '—'}%</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-amber-50 to-amber-25 dark:from-amber-900/20 dark:to-amber-800/20">
                            <div className="flex items-center space-x-2">
                              <Droplets className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">pH</span>
                            </div>
                            <span className="font-bold text-espresso-900 dark:text-white">{latestData?.ph && !Number.isNaN(latestData.ph) ? latestData.ph.toFixed(2) : '—'}</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-50 to-purple-25 dark:from-purple-900/20 dark:to-purple-800/20">
                            <div className="flex items-center space-x-2">
                              <Droplets className="h-4 w-4 text-purple-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">EC</span>
                            </div>
                            <span className="font-bold text-espresso-900 dark:text-white">{latestData?.ec && !Number.isNaN(latestData.ec) ? latestData.ec.toFixed(2) : '—'} mS/cm</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-25 dark:from-emerald-900/20 dark:to-emerald-800/20">
                            <div className="flex items-center space-x-2">
                              <Sprout className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">NPK</span>
                            </div>
                            <div className="text-xs text-espresso-900 dark:text-white text-right">
                              <div>N: {latestData?.nitrogen && !Number.isNaN(latestData.nitrogen) ? latestData.nitrogen.toFixed(0) : '—'}</div>
                              <div>P: {latestData?.phosphorus && !Number.isNaN(latestData.phosphorus) ? latestData.phosphorus.toFixed(0) : '—'}</div>
                              <div>K: {latestData?.potassium && !Number.isNaN(latestData.potassium) ? latestData.potassium.toFixed(0) : '—'}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-cyan-50 to-cyan-25 dark:from-cyan-900/20 dark:to-cyan-800/20">
                            <div className="flex items-center space-x-2">
                              <Droplets className="h-4 w-4 text-cyan-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Water Level</span>
                            </div>
                            <span className="font-bold text-espresso-900 dark:text-white">
                              {(latestData.waterLevel ?? null) !== null ? (latestData.waterLevel === 1 ? 'Present' : 'Low') : '—'}
                            </span>
                          </div>

                          {latestData.batteryLevel && (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-secondary-50 to-secondary-25 dark:from-secondary-900/20 dark:to-secondary-800/20">
                              <div className="flex items-center space-x-2">
                                <Battery className="h-4 w-4 text-secondary-500" />
                                <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Battery</span>
                              </div>
                              <span className="font-bold text-espresso-900 dark:text-white">{latestData.batteryLevel.toFixed(0)}%</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-25 dark:from-gray-900/20 dark:to-gray-800/20">
                            <div className="flex items-center space-x-2">
                              <RefreshCw className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Last Update</span>
                            </div>
                            <span className="font-bold text-xs text-espresso-900 dark:text-white">
                              {latestData?.timestamp ? format(new Date(latestData.timestamp), 'HH:mm:ss') : '—'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 min-h-[20px]"></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="col-span-4 text-center py-16">
                  <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Sensors Connected</h3>
                  <p className="text-gray-500">Connect sensors to start monitoring environmental data.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MockDashboard;