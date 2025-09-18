import React, { useState } from 'react';
import { Leaf, AlertTriangle, Thermometer, Droplets, Sprout, Battery, Activity, RefreshCw, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import DarkModeToggle from '../components/DarkModeToggle';
import weatherService from '../services/weatherService';
import { useEffect } from 'react';
import { useData } from '../contexts/DataContext';

// Hardcoded sample data to avoid any refresh loops or API issues
const sampleSensorData = [
  {
    _id: 'sample_1',
    deviceId: 'BEAN001',
    temperature: 29.5,
    humidity: 78,
    moisture: 65,
    ph: 6.8,
    ec: 1.2,
    nitrogen: 45,
    phosphorus: 28,
    potassium: 180,
    waterLevel: 1,
    timestamp: new Date().toISOString(),
    status: 'normal' as const,
    batteryLevel: 85,
    signalStrength: -45,
  },
  {
    _id: 'sample_2', 
    deviceId: 'BEAN002',
    temperature: 31.2,
    humidity: 72,
    moisture: 58,
    ph: 7.2,
    ec: 0.9,
    nitrogen: 52,
    phosphorus: 32,
    potassium: 195,
    waterLevel: 0,
    timestamp: new Date().toISOString(),
    status: 'normal' as const,
    batteryLevel: 92,
    signalStrength: -38,
  },
  {
    _id: 'sample_3',
    deviceId: 'BEAN003',
    temperature: 28.8,
    humidity: 81,
    moisture: 71,
    ph: 6.5,
    ec: 1.5,
    nitrogen: 38,
    phosphorus: 25,
    potassium: 165,
    waterLevel: 1,
    timestamp: new Date().toISOString(),
    status: 'warning' as const,
    batteryLevel: 78,
    signalStrength: -52,
  }
];

const PublicDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sensors'>('overview');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
      console.log('Public Dashboard: Data refreshed');
    }, 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  case 'warning': return 'text-secondary-600 bg-secondary-100 dark:text-secondary-400 dark:bg-secondary-900/30';
      case 'critical': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
    }
  };

  const avgTemperature = Math.round(sampleSensorData.reduce((sum, d) => sum + d.temperature, 0) / sampleSensorData.length);
  const avgHumidity = Math.round(sampleSensorData.reduce((sum, d) => sum + d.humidity, 0) / sampleSensorData.length);
  const avgMoisture = Math.round(sampleSensorData.reduce((sum, d) => sum + d.moisture, 0) / sampleSensorData.length);
  const [manilaWeather, setManilaWeather] = React.useState<any | null>(null);
  const { latestSensorData } = useData();

  // compute latest pH if available (use latestSensorData array)
  const latestPh = React.useMemo(() => {
    if (!Array.isArray(latestSensorData) || latestSensorData.length === 0) return null;
    // prefer the most recent reading that includes ph
    for (let i = latestSensorData.length - 1; i >= 0; i--) {
      const d = latestSensorData[i] as any;
      if (typeof d.ph === 'number') return d.ph;
    }
    // fallback: compute average of available ph values
    const phVals = latestSensorData.map((d: any) => d.ph).filter((v: any) => typeof v === 'number');
    if (phVals.length === 0) return null;
    return phVals.reduce((s: number, v: number) => s + v, 0) / phVals.length;
  }, [latestSensorData]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const summary = await weatherService.getManilaWeatherSummary();
        if (mounted) setManilaWeather(summary);
      } catch (err) {
        console.warn('PublicDashboard: could not load Manila weather', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
  {/* header typography cleaned by site-title/site-subtitle/site-badge styles */}
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
                      <span>Live</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 mt-1">
                  <p className="site-subtitle text-sm font-medium">
                    Environmental Monitoring System
                  </p>
                  <div className="site-badge bg-gradient-to-r from-teal-50 to-purple-50 dark:from-teal-900/20 dark:to-purple-900/20 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300 shadow-sm">
                    <Activity className="w-3 h-3" />
                    <span>Public Dashboard</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status & Controls */}
            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className="hidden md:flex items-center space-x-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-300">System Online</span>
              </div>

              {/* Quick Stats */}
              <div className="hidden lg:flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  <span className="font-medium">Live Data</span>
                </div>
                <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                  <Activity className="w-4 h-4 text-teal-500" />
                  <span className="font-medium">Real-time</span>
                </div>
              </div>

              {/* Dark Mode Toggle */}
              <div className="flex items-center">
                <DarkModeToggle />
              </div>
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
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'sensors', label: 'Sensors', icon: Thermometer }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as 'overview' | 'sensors')}
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
          <div className="space-y-6">
            {/* Premium Glass Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-8 items-stretch w-full">
              
              {/* Temperature Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-letran-500 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-red-100 to-red-50 dark:from-red-800 dark:to-red-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Thermometer className="h-6 w-6 text-red-600 dark:text-red-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Temperature</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).temperature || avgTemperature : avgTemperature}°C
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* Humidity Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-primary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-primary-500 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-800 dark:to-blue-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Humidity</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).humidity || avgHumidity : avgHumidity}%
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* pH Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-amber-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-400 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-800 dark:to-amber-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Droplets className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">pH</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {latestPh !== null ? latestPh.toFixed(2) : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* Battery Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-secondary-500/20 to-secondary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary-500 to-secondary-500 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-secondary-100 to-secondary-50 dark:from-secondary-800 dark:to-secondary-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Battery className="h-6 w-6 text-secondary-600 dark:text-secondary-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Battery</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).batteryLevel || 85 : 85}%
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* EC Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-800 dark:to-purple-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Droplets className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">EC</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).ec ? ((latestSensorData[latestSensorData.length - 1] as any).ec).toFixed(2) : '—'} mS/cm
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* NPK Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-400 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-800 dark:to-green-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Sprout className="h-6 w-6 text-green-600 dark:text-green-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">NPK</p></div>
                      <div className="text-sm text-espresso-900 dark:text-white">
                        <div>N: {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).nitrogen ? ((latestSensorData[latestSensorData.length - 1] as any).nitrogen).toFixed(0) : '—'}</div>
                        <div>P: {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).phosphorus ? ((latestSensorData[latestSensorData.length - 1] as any).phosphorus).toFixed(0) : '—'}</div>
                        <div>K: {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).potassium ? ((latestSensorData[latestSensorData.length - 1] as any).potassium).toFixed(0) : '—'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* Water Level Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-800 dark:to-cyan-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Droplets className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Water Level</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).waterLevel !== undefined ? ((latestSensorData[latestSensorData.length - 1] as any).waterLevel === 1 ? 'Present' : 'Low') : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>

              {/* Active Devices Card */}
              <div className="group relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-letran-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 flex flex-col h-full dashboard-card">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-letran-500 rounded-t-2xl"></div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl mr-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-800 dark:to-blue-700 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Activity className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-h-[72px]">
                      <div className="mb-2"><p className="text-sm font-medium text-espresso-600 dark:text-gray-300">Active Devices</p></div>
                      <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {Array.isArray(latestSensorData) ? latestSensorData.length : sampleSensorData.length}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[140px]"></div>
                </div>
              </div>
            </div>

            {/* Latest Sensor Data */}
            <div className="coffee-card-alt" data-theme="dark-panel">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Latest Sensor Readings</h3>
              </div>
        <div className="p-6">
        <div className="space-y-4">
          {(Array.isArray(latestSensorData) && latestSensorData.length > 0 ? latestSensorData : sampleSensorData).map((data) => (
          <div key={data._id} className="p-4 rounded-lg dashboard-row border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(data.status).replace('text-', 'bg-').replace('bg-', 'bg-')}`}></div>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{data.deviceId}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(data.timestamp), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Battery: {data.batteryLevel}%</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Temperature</p>
                          <p className="font-bold text-red-600 dark:text-red-400">{data.temperature}°C</p>
                        </div>
                        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Humidity</p>
                          <p className="font-bold text-blue-600 dark:text-blue-400">{data.humidity}%</p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">pH</p>
                          <p className="font-bold text-amber-600 dark:text-amber-400">{data.ph || '—'}</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">EC</p>
                          <p className="font-bold text-purple-600 dark:text-purple-400">{data.ec || '—'} mS/cm</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">NPK</p>
                          <p className="font-bold text-green-600 dark:text-green-400 text-xs">
                            N:{data.nitrogen || '—'}<br/>P:{data.phosphorus || '—'}<br/>K:{data.potassium || '—'}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Water Level</p>
                          <p className="font-bold text-cyan-600 dark:text-cyan-400">{data.waterLevel === 1 ? 'Present' : data.waterLevel === 0 ? 'Low' : '—'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        

        {activeTab === 'sensors' && (
          <div className="space-y-6">
            {/* Sensor Types Status */}
            <div className="coffee-card-alt" data-theme="dark-panel">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sensor Types Status</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">All sensor types currently active and monitoring</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* Temperature Sensor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900 mr-4">
                      <Thermometer className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Temperature</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).temperature || '29.5' : '29.5'}°C</p>
                    </div>
                  </div>

                  {/* Humidity Sensor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900 mr-4">
                      <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Humidity</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).humidity || '78' : '78'}%</p>
                    </div>
                  </div>

                  {/* pH Sensor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900 mr-4">
                      <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><path d="M7 8v6a5 5 0 0 0 10 0V8"/></svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">pH Level</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • pH {latestPh !== null ? latestPh.toFixed(1) : '6.8'}</p>
                    </div>
                  </div>

                  {/* EC Sensor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900 mr-4">
                      <Droplets className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">EC Sensor</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).ec ? ((latestSensorData[latestSensorData.length - 1] as any).ec).toFixed(1) : '1.2'} mS/cm</p>
                    </div>
                  </div>

                  {/* NPK Sensor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-green-100 dark:bg-green-900 mr-4">
                      <Sprout className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">NPK Sensor</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • N:{Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).nitrogen ? ((latestSensorData[latestSensorData.length - 1] as any).nitrogen) : '45'}</p>
                    </div>
                  </div>

                  {/* Water Level Sensor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900 mr-4">
                      <Droplets className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Water Level</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • {Array.isArray(latestSensorData) && latestSensorData.length > 0 && (latestSensorData[latestSensorData.length - 1] as any).waterLevel !== undefined ? ((latestSensorData[latestSensorData.length - 1] as any).waterLevel === 1 ? 'Present' : 'Low') : 'Present'}</p>
                    </div>
                  </div>

                  {/* Battery Monitor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-secondary-100 dark:bg-secondary-900 mr-4">
                      <Battery className="h-6 w-6 text-secondary-600 dark:text-secondary-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Battery Monitor</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).batteryLevel || 85 : 85}% avg</p>
                    </div>
                  </div>

                  {/* Signal Monitor */}
                  <div className="flex items-center p-4 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900 mr-4">
                      <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Signal Monitor</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Active • {Array.isArray(latestSensorData) && latestSensorData.length > 0 ? (latestSensorData[latestSensorData.length - 1] as any).signalStrength || '-45' : '-45'} dBm avg</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicDashboard;
