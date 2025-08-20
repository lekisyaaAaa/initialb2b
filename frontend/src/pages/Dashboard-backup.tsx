import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SensorData, Alert } from '../types';
import { Leaf, AlertTriangle, Thermometer, Droplets, Sprout, Battery, RefreshCw, Settings, TrendingUp, LogIn, LogOut, User } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import DarkModeToggle from '../components/DarkModeToggle';

const Dashboard: React.FC = () => {
  const { latestSensorData, recentAlerts, isConnected, isLoading, refreshData } = useData();
  const { user, logout, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'sensors' | 'settings'>('overview');
  
  // Check if current user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // Database Status Check Function - Admin Only
  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/sensors/latest');
      const data = await response.json();
      alert(' Database Status: ' + (data.success ? 'Connected & Active' : 'No Data Available'));
      console.log('Database check result:', data);
    } catch (error) {
      alert(' Database Check Failed - Backend may be offline');
      console.error('Database check error:', error);
    }
  };

  const unresolvedAlerts = recentAlerts.filter((alert: Alert) => !alert.isResolved);

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
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
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                <span className="text-sm text-espresso-600 dark:text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <DarkModeToggle />

              <button
                onClick={refreshData}
                disabled={isLoading}
                className="p-2 text-espresso-400 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <div className="flex items-center space-x-2">
                {isAdmin ? (
                  <>
                    <div className="text-right">
                      <p className="text-sm font-medium text-espresso-900 dark:text-white">
                        <User className="inline h-4 w-4 mr-1" />
                        {user?.username}
                      </p>
                      <p className="text-xs text-espresso-600 dark:text-gray-300">
                        {user?.role} - Admin Dashboard
                      </p>
                    </div>
                    <button
                      onClick={checkDatabaseStatus}
                      className="p-2 text-espresso-400 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      title="Check Database Status"
                    >
                      <span className="text-lg"></span>
                    </button>
                    <button
                      onClick={logout}
                      className="p-2 text-espresso-400 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-right">
                      {isAuthenticated ? (
                        <>
                          <p className="text-sm font-medium text-espresso-900 dark:text-white">
                            <User className="inline h-4 w-4 mr-1" />
                            {user?.username}
                          </p>
                          <p className="text-xs text-espresso-600 dark:text-gray-300">
                            {user?.role} - Limited Access
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-espresso-900 dark:text-white">Environmental Monitor</p>
                          <p className="text-xs text-espresso-600 dark:text-gray-300">Public Dashboard</p>
                        </>
                      )}
                    </div>
                    {isAuthenticated ? (
                      <button
                        onClick={logout}
                        className="p-2 text-espresso-400 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                        title="Logout"
                      >
                        <LogOut className="h-5 w-5" />
                      </button>
                    ) : (
                      <Link
                        to="/login"
                        className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-espresso-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 border border-coffee-300 dark:border-gray-600 rounded-md hover:border-primary-300 dark:hover:border-primary-500 transition-colors"
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-espresso-900 dark:text-white mb-4">Environmental Monitoring Dashboard</h2>
          <p className="text-espresso-600 dark:text-gray-300 mb-8">Monitor your environmental conditions in real-time</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-espresso-900 dark:text-white mb-2">Sensors</h3>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{latestSensorData.length}</p>
              <p className="text-sm text-espresso-600 dark:text-gray-300">Active Sensors</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-espresso-900 dark:text-white mb-2">Alerts</h3>
              <p className="text-3xl font-bold text-warning-600 dark:text-warning-400">{unresolvedAlerts.length}</p>
              <p className="text-sm text-espresso-600 dark:text-gray-300">Unresolved Alerts</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-espresso-900 dark:text-white mb-2">Connection</h3>
              <p className={`text-3xl font-bold ${isConnected ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                {isConnected ? '' : ''}
              </p>
              <p className="text-sm text-espresso-600 dark:text-gray-300">
                {isConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-6">
              <p className="text-purple-800 dark:text-purple-200">
                 <strong>Admin Access:</strong> Click the  button in the header to check database status
              </p>
            </div>
          )}

          {isLoading && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-200">
                 Loading latest data...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
