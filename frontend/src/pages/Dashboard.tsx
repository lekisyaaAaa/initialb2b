import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Alert } from '../types';
import {
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
  Shield,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import ChartContainer from '../components/charts/ChartContainer';
import AlertSummaryChart from '../components/charts/AlertSummaryChart';
import DarkModeToggle from '../components/DarkModeToggle';
import HeaderFrame from '../components/layout/HeaderFrame';

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatFixed = (value: number | null | undefined, digits = 1) =>
  isFiniteNumber(value) ? value.toFixed(digits) : '—';

const formatInteger = (value: number | null | undefined) =>
  isFiniteNumber(value) ? value.toFixed(0) : '—';
const Dashboard: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { latestSensorData, recentAlerts, isConnected, isLoading, refreshData, lastFetchAt } = useData();
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'alerts' | 'sensors'>('overview');
  const [lastManualRefresh, setLastManualRefresh] = useState<Date | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  // Check if current user is admin
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const safeLatestSensorData = useMemo(() => latestSensorData, [latestSensorData]);

  // Calculate alert summary for pie chart
  const alertSummary = useMemo(() => {
    const summary = recentAlerts.reduce((acc: Record<string, number>, alert: Alert) => {
      const sev = (alert.severity || 'unknown').toString();
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(summary).map(([severity, count]) => ({
      severity,
      count: count as number
    }));
  }, [recentAlerts]);

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

  const unresolvedAlerts = useMemo(() => recentAlerts.filter((alert: Alert) => !alert.isResolved), [recentAlerts]);

  const lastRefreshLabel = useMemo(() => {
    const source = lastManualRefresh ?? (lastFetchAt ? new Date(lastFetchAt) : null);
    if (!source) return 'Never';
    return format(source, 'MMM dd, yyyy \u2022 HH:mm:ss');
  }, [lastFetchAt, lastManualRefresh]);

  const handleRefresh = async () => {
    try {
      await refreshData();
      setLastManualRefresh(new Date());
    } catch (error) {
      // DataContext already surfaces errors; no-op here
    }
  };

  // Connection badge mirrors the admin header so both roles share the same visual rhythm.
  const connectionBadge = (
    <div
      className={`hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        isConnected
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
          : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
        }`}
      />
      {isConnected ? 'Sensors Live' : 'Awaiting Sensor Connection'}
    </div>
  );

  // Right-side controls stay modular so user/admin variants only swap the button set.
  const headerActions = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-coffee-200 bg-white text-coffee-600 transition-colors hover:border-coffee-300 hover:text-coffee-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white ${
            isLoading ? 'cursor-wait opacity-70' : ''
          }`}
          title="Refresh sensor data"
          disabled={isLoading}
        >
          <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <span className="hidden text-xs text-coffee-500 dark:text-slate-200 xl:inline">Last refresh {lastRefreshLabel}</span>
      </div>

      <div className="flex items-center gap-3">
        <DarkModeToggle />
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-coffee-700 dark:text-slate-100">
              <User className="h-4 w-4" />
              {user?.username}
            </span>
            {isAdmin ? (
              <span className="rounded-full border border-coffee-200 bg-white px-2 py-1 text-xs font-semibold text-coffee-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Admin
              </span>
            ) : null}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-coffee-500 transition-colors hover:border-coffee-300 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-400"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 rounded-full border border-coffee-200 bg-white px-3 py-1.5 text-sm font-medium text-coffee-700 transition-colors hover:border-coffee-300 hover:text-coffee-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <LogIn className="h-4 w-4" />
            Login
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900">
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Logout</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Are you sure you want to sign out of your session?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Stay signed in
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                  navigate('/login', { replace: true });
                }}
              >
                Yes, logout
              </button>
            </div>
          </div>
        </div>
      )}

      <HeaderFrame
        titleSuffix="Dashboard"
        subtitle="Live environmental monitoring"
        badgeLabel="User Dashboard"
        badgeTone="default"
        contextTag={connectionBadge}
        rightSlot={headerActions}
      />

  {/* Navigation Tabs */}
  <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-coffee-200/70 dark:border-gray-800/70">
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
        {!isConnected && safeLatestSensorData.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-dashed border-coffee-300 dark:border-gray-700 rounded-xl p-12 text-center shadow-sm">
            <Thermometer className="w-12 h-12 mx-auto mb-4 text-coffee-300 dark:text-gray-500" />
            <h2 className="text-xl font-semibold text-coffee-800 dark:text-gray-200">No Sensor Detected</h2>
            <p className="mt-2 text-sm text-coffee-600 dark:text-gray-400">The system will populate measurements automatically once a sensor is connected and reporting.</p>
            <div className="mt-4 text-xs text-coffee-400 dark:text-gray-500">
              Last refresh: {lastRefreshLabel}
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-8">
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
                            <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{`${formatFixed(latestReadings?.temperature, 1)}°C`}</p>
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
                            <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{`${formatFixed(latestReadings?.humidity, 1)}%`}</p>
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
                            <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{formatFixed(latestReadings?.ph, 2)}</p>
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
                              {isFiniteNumber(latestReadings?.batteryLevel) ? `${formatInteger(latestReadings?.batteryLevel)}%` : 'N/A%'}
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
                            <p className="text-3xl font-bold text-espresso-900 dark:text-white group-hover:text-letran-600 dark:group-hover:text-letran-400 transition-colors">{`${formatFixed(latestReadings?.ec, 2)} mS/cm`}</p>
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
                                <div>N: {formatInteger(latestReadings?.nitrogen)}</div>
                                <div>P: {formatInteger(latestReadings?.phosphorus)}</div>
                                <div>K: {formatInteger(latestReadings?.potassium)}</div>
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
                              {(latestReadings?.waterLevel ?? null) !== null ? (latestReadings?.waterLevel === 1 ? 'Present' : 'Low') : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex-1 min-h-[140px]"></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700">
                    <div className="p-6 border-b border-coffee-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-coffee-900 dark:text-white flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-coffee-600 dark:text-gray-200" />
                        Recent Alerts ({unresolvedAlerts.length} unresolved)
                      </h3>
                    </div>
                    <div className="p-6">
                      {alertSummary.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {recentAlerts.slice(0, 5).map((alert: Alert, index: number) => (
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
                <ChartContainer data={safeLatestSensorData} title="Current Environmental Data" />
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
                    {recentAlerts.length > 0 ? (
                      <div className="space-y-4">
                        {recentAlerts.map((alert: Alert, index: number) => (
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
                              <div
                                className={`px-2 py-1 rounded-full text-xs ${
                                  alert.isResolved
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                }`}
                              >
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

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {deviceIds.length > 0 ? (
                    deviceIds.map(deviceId => {
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
                                  <span className="font-bold text-espresso-900 dark:text-white">{`${formatFixed(latestData.temperature, 1)}°C`}</span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-25 dark:from-blue-900/20 dark:to-blue-800/20">
                                  <div className="flex items-center space-x-2">
                                    <Droplets className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Humidity</span>
                                  </div>
                                  <span className="font-bold text-espresso-900 dark:text-white">{`${formatFixed(latestData.humidity, 1)}%`}</span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-25 dark:from-green-900/20 dark:to-green-800/20">
                                  <div className="flex items-center space-x-2">
                                    <Sprout className="h-4 w-4 text-green-500" />
                                    <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Moisture</span>
                                  </div>
                                  <span className="font-bold text-espresso-900 dark:text-white">{`${formatFixed(latestData.moisture, 1)}%`}</span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-amber-50 to-amber-25 dark:from-amber-900/20 dark:to-amber-800/20">
                                  <div className="flex items-center space-x-2">
                                    <Droplets className="h-4 w-4 text-amber-500" />
                                    <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">pH</span>
                                  </div>
                                  <span className="font-bold text-espresso-900 dark:text-white">{formatFixed(latestData.ph, 2)}</span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-50 to-purple-25 dark:from-purple-900/20 dark:to-purple-800/20">
                                  <div className="flex items-center space-x-2">
                                    <Droplets className="h-4 w-4 text-purple-500" />
                                    <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">EC</span>
                                  </div>
                                  <span className="font-bold text-espresso-900 dark:text-white">{`${formatFixed(latestData.ec, 2)} mS/cm`}</span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-25 dark:from-emerald-900/20 dark:to-emerald-800/20">
                                  <div className="flex items-center space-x-2">
                                    <Sprout className="h-4 w-4 text-emerald-500" />
                                    <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">NPK</span>
                                  </div>
                                  <div className="text-xs text-espresso-900 dark:text-white text-right">
                                    <div>N: {formatInteger(latestData.nitrogen)}</div>
                                    <div>P: {formatInteger(latestData.phosphorus)}</div>
                                    <div>K: {formatInteger(latestData.potassium)}</div>
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

                                {isFiniteNumber(latestData.batteryLevel) && (
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-secondary-50 to-secondary-25 dark:from-secondary-900/20 dark:to-secondary-800/20">
                                    <div className="flex items-center space-x-2">
                                      <Battery className="h-4 w-4 text-secondary-500" />
                                      <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Battery</span>
                                    </div>
                                    <span className="font-bold text-espresso-900 dark:text-white">{`${formatInteger(latestData.batteryLevel)}%`}</span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-gray-50 to-gray-25 dark:from-gray-900/20 dark:to-gray-800/20">
                                  <div className="flex items-center space-x-2">
                                    <RefreshCw className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-espresso-600 dark:text-gray-300">Last Update</span>
                                  </div>
                                  <span className="font-bold text-xs text-espresso-900 dark:text-white">
                                    {latestData.timestamp ? format(new Date(latestData.timestamp), 'HH:mm:ss') : '—'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-16">
                      <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Sensors Connected</h3>
                      <p className="text-gray-500 dark:text-gray-400">Connect sensors to start monitoring environmental data.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;