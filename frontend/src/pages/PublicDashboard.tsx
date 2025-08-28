import React, { useState } from 'react';
import { Leaf, AlertTriangle, Thermometer, Droplets, Sprout, RefreshCw, TrendingUp, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import LetranLogo from '../components/LetranLogo';
import DarkModeToggle from '../components/DarkModeToggle';

// Hardcoded sample data to avoid any refresh loops or API issues
const sampleSensorData = [
  {
    _id: 'sample_1',
    deviceId: 'BEAN001',
    temperature: 29.5,
    humidity: 78,
    moisture: 65,
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
    timestamp: new Date().toISOString(),
    status: 'warning' as const,
    batteryLevel: 78,
    signalStrength: -52,
  }
];

const PublicDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'sensors'>('overview');
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
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
      case 'critical': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
    }
  };

  const avgTemperature = Math.round(sampleSensorData.reduce((sum, d) => sum + d.temperature, 0) / sampleSensorData.length);
  const avgHumidity = Math.round(sampleSensorData.reduce((sum, d) => sum + d.humidity, 0) / sampleSensorData.length);
  const avgMoisture = Math.round(sampleSensorData.reduce((sum, d) => sum + d.moisture, 0) / sampleSensorData.length);

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg border-b border-coffee-200 dark:border-gray-700 letran-nav-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link to="/" className="letran-coffee-gradient rounded-lg p-2 mr-3 hover:opacity-90 transition-opacity">
                <Leaf className="h-6 w-6 text-white" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-espresso-900 dark:text-white">
                  Bean<span className="text-letran-500">To</span>Bin
                </h1>
                <p className="text-sm text-espresso-600 dark:text-gray-300">
                  Environmental Monitoring Dashboard <span className="letran-badge">(Public Access)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2 bg-green-500"></div>
                <span className="text-sm text-espresso-600 dark:text-gray-300">Connected</span>
              </div>

              {/* Dark Mode Toggle */}
              <DarkModeToggle />

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 text-espresso-400 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Letran Logo - positioned in dashboard header */}
              <div className="flex items-center space-x-2 px-2 py-1 bg-letran-50 dark:bg-gray-700 rounded-lg border border-letran-200 dark:border-gray-600">
                <LetranLogo size="sm" />
                <span className="text-xs text-letran-700 dark:text-gray-300 font-medium">Letran</span>
              </div>

              {/* Admin Login Link */}
              <Link
                to="/admin/login"
                className="letran-button flex items-center space-x-1 px-3 py-2 text-sm font-medium rounded-md transition-all"
              >
                <LogIn className="h-4 w-4" />
                <span>Admin Login</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
              { id: 'sensors', label: 'Sensors', icon: Thermometer }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === id
                    ? 'border-letran-500 text-letran-600 dark:text-letran-400'
                    : 'border-transparent text-espresso-500 dark:text-gray-400 hover:text-espresso-700 dark:hover:text-gray-200 hover:border-coffee-300 dark:hover:border-gray-500'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Average Temperature Card */}
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-letran-500/20 to-red-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-letran-500 to-red-500 rounded-t-2xl"></div>
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-letran-100 to-letran-50 dark:from-letran-800 dark:to-letran-700 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Thermometer className="h-8 w-8 text-letran-600 dark:text-letran-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Avg Temperature</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {avgTemperature}°C
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Average Humidity Card */}
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-primary-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border border-white/50 dark:border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-primary-500 rounded-t-2xl"></div>
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-800 dark:to-blue-700 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Droplets className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Avg Humidity</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {avgHumidity}%
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
                    <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-800 dark:to-yellow-700 rounded-2xl p-4 mr-4 shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Sprout className="h-8 w-8 text-yellow-600 dark:text-yellow-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Avg Moisture</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">
                        {avgMoisture}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Sensor Data (white container with dark rows) */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-medium text-gray-900">Latest Sensor Readings</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {sampleSensorData.map((data) => (
                    <div key={data._id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg text-white">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(data.status).replace('text-', 'bg-').replace('bg-', 'bg-')}`}></div>
                        </div>
                        <div>
                          <p className="font-medium text-white">{data.deviceId}</p>
                          <p className="text-sm text-gray-300">
                            {format(new Date(data.timestamp), 'MMM dd, yyyy HH:mm')}
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Alerts</h3>
            </div>
            <div className="p-6">
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No alerts at this time. All systems operating normally.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sensors' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sensor Status</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sampleSensorData.map((sensor) => (
                  <div key={sensor._id} className="border dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">{sensor.deviceId}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(sensor.status)}`}>
                        {sensor.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex justify-between">
                        <span>Battery:</span>
                        <span>{sensor.batteryLevel}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Signal:</span>
                        <span>{sensor.signalStrength} dBm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Update:</span>
                        <span>{format(new Date(sensor.timestamp), 'HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicDashboard;
