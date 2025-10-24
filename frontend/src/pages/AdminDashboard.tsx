/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Bell, Check, Settings, Activity, Users, BarChart3, Calendar } from 'lucide-react';
import SensorCharts from '../components/SensorCharts';
import SystemHealth from '../components/SystemHealth';
import SensorCard from '../components/SensorCard';
import AlertsPanel from '../components/AlertsPanel';
import DarkModeToggle from '../components/DarkModeToggle';
import HeaderFrame from '../components/layout/HeaderFrame';
import ActuatorControls from '../components/ActuatorControls';
import { DeviceManagement } from '../components/DeviceManagement';
import { ThresholdConfiguration } from '../components/ThresholdConfiguration';
import { AlertsManagement } from '../components/AlertsManagement';
import { SystemDiagnostics } from '../components/SystemDiagnostics';
import { useAuth } from '../contexts/AuthContext';
import weatherService from '../services/weatherService';
import { alertService } from '../services/api';

type Sensor = {
  id: string;
  name: string;
  deviceId: string;
  temperature?: number | null;
  humidity?: number | null;
  moisture?: number | null;
  ph?: number | null;
  ec?: number | null;
  npk?: { n?: number; p?: number; k?: number } | null;
  waterLevel?: number | null;
  batteryLevel?: number | null;
  lastSeen?: string | null;
};

type Alert = { id: string; _id?: string; type?: string; title: string; severity: 'info' | 'warning' | 'critical'; message?: string; createdAt: string; acknowledged?: boolean };

type StatusPillProps = { label: string; status: string };

const StatusPill: React.FC<StatusPillProps> = ({ label, status }) => {
  const normalized = (status ?? '').toString().toLowerCase();
  const healthyStates = new Set(['online', 'connected', 'ok', 'ready', 'healthy', 'up', 'available', 'reachable']);
  const isHealthy = healthyStates.has(normalized);
  const baseColor = isHealthy
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
    : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300';

  // Shared status pill keeps infrastructure metrics aligned between dashboards.
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${baseColor}`}>
      <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {label}: {status}
    </span>
  );
};

export default function AdminDashboard(): React.ReactElement {
  const { user, logout } = useAuth();
  const [latestSensor, setLatestSensor] = useState<Sensor | null>(null);
  const [sensorHistory, setSensorHistory] = useState<Sensor[]>([]);
  const cardClass = 'p-4 rounded-xl bg-white dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 shadow';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<any | null>(null);
  const [systemStatus, setSystemStatus] = useState<{ server: string; database: string; apiLatency: number }>({ server: 'offline', database: 'offline', apiLatency: 0 });
  const [devicesOnline, setDevicesOnline] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Maintenance reminders state (populated from backend)
  const [reminders, setReminders] = useState<Array<any>>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<string>('Checking...');
  const [isAddingSensor, setIsAddingSensor] = useState(false);
  const [actuatorLogs, setActuatorLogs] = useState<any[]>([]);
  const [latestAlerts, setLatestAlerts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadReminders() {
    setRemindersLoading(true);
    try {
      let res = await fetch('/api/maintenance');
      if (!res.ok) {
        res = await fetch('/api/settings/maintenance');
      }
      if (!res.ok) {
        setReminders([]);
        return;
      }
      const body = await res.json().catch(() => ({}));
      const list = Array.isArray(body.data) ? body.data : (Array.isArray(body) ? body : []);
      setReminders(list);
    } catch (e) {
      setReminders([]);
    } finally {
      setRemindersLoading(false);
    }
  }

  async function loadActuatorLogs() {
    try {
      const res = await fetch('/api/actuators/logs?limit=200');
      if (!res.ok) return setActuatorLogs([]);
      const body = await res.json().catch(() => ({}));
      setActuatorLogs(body.logs || []);
    } catch (e) {
      setActuatorLogs([]);
    }
  }

  async function loadLatestAlerts() {
    // Use the recent (unresolved) alerts endpoint instead of the admin-only
    // `/alerts/latest`. Public dashboard creates alerts via `/alerts` and
    // `/alerts/recent` returns the unresolved alerts. This ensures the Admin
    // dashboard shows the same active alerts as the User dashboard.
    try {
      const response = await alertService.getRecentAlerts(50);
      if (response?.data?.success) {
        const alerts = Array.isArray(response.data.data) ? response.data.data : [];
        setLatestAlerts(alerts);
        setUnreadCount(alerts.filter((alert: any) => (alert.status || alert.state || '').toString() === 'new').length);
      } else {
        setLatestAlerts([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to load recent alerts:', error);
      setLatestAlerts([]);
      setUnreadCount(0);
    }
  }

  async function markAlertAsRead(alertId: string) {
    try {
      await alertService.markAsRead(alertId);
      // Update local state
      setLatestAlerts(prev => prev.map(alert =>
        alert._id === alertId ? { ...alert, status: 'read' } : alert
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  }

  function acknowledgeReminder(id: string) {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, acknowledged: true } : r));
    fetch(`/api/maintenance/ack/${encodeURIComponent(id)}`, { method: 'POST' }).catch(() => { /* ignore */ });
  }

  function scheduleReminder(id: string) {
    const rem = reminders.find(r => r.id === id);
    const when = prompt(`Schedule maintenance for '${rem?.title}'. Enter date (YYYY-MM-DD) or days from now:`);
    if (!when) return;
    fetch(`/api/maintenance/schedule/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ when }) }).catch(() => { /* ignore */ });
    alert('Schedule requested (best-effort).');
  }

  async function addSensor() {
    setIsAddingSensor(true);
    try {
      // Register a new sensor
      const res = await fetch('/api/sensors/register', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ deviceId: 'new-sensor-' + Date.now() }) 
      });
      if (res.ok) {
        setSensorStatus('Sensor successfully connected');
        // Sensor data will be refreshed automatically by the polling interval
      } else {
        setSensorStatus('No sensors connected');
      }
    } catch (e) {
      setSensorStatus('No sensors connected');
    } finally {
      setIsAddingSensor(false);
    }
  }

  // Search UI state

  function fmtLastSeen(iso?: string | null) { if (!iso) return 'No data'; try { return new Date(iso).toLocaleString(); } catch { return String(iso); } }

  useEffect(() => {
    let mounted = true;
    async function loadLatest() {
      try {
  const start = Date.now();
  const res = await fetch('/api/sensors/latest', { cache: 'no-store' });
  const end = Date.now();
  if (!mounted) return;
  const latency = end - start;
        if (res.ok) {
          const data = await res.json();
          console.debug('AdminDashboard::loadLatest success', { latency, data });
          const payload = data?.data;
          let latestReading: Sensor | null = null;

          if (Array.isArray(payload)) {
            latestReading = (payload.length > 0 ? (payload[0] as Sensor) : null);
          } else if (payload && typeof payload === 'object') {
            latestReading = payload as Sensor;
          }

          if (latestReading) {
            setLatestSensor(latestReading);
            setSensorHistory(prev => {
              const next = [...prev.slice(-199), latestReading as Sensor];
              return next;
            });
          }

          const derivedDatabaseStatus = (data?.databaseStatus || data?.database?.status || data?.database || data?.metadata?.databaseStatus || 'online');
          const serverStatus = (data?.status || data?.systemStatus || data?.serverStatus || data?.server || 'online');
          const toStatusString = (value: unknown, fallback: string) => {
            if (typeof value === 'string' && value.trim().length > 0) {
              return value.trim().toLowerCase();
            }
            return fallback;
          };
          const healthyValue = (value: string) => (
            ['online', 'connected', 'ok', 'ready', 'healthy', 'up', 'available', 'reachable'].includes(value)
              ? 'online'
              : value
          );
          const normalizedServerStatus = healthyValue(toStatusString(serverStatus, 'online'));
          const normalizedDatabaseStatus = healthyValue(toStatusString(derivedDatabaseStatus, 'online'));

          setSystemStatus({
            server: normalizedServerStatus,
            database: normalizedDatabaseStatus,
            apiLatency: latency,
          });
        } else {
          console.debug('AdminDashboard::loadLatest non-200', { status: res.status, statusText: res.statusText });
          setSystemStatus({ server: 'offline', database: 'offline', apiLatency: latency });
        }
      } catch (e) {
        console.warn('AdminDashboard::loadLatest error', e);
        setSystemStatus({ server: 'offline', database: 'offline', apiLatency: 0 });
      }
    }

    async function loadAlerts() {
      try {
        // Use alertService to fetch alerts and respect the backend's
        // paginated response shape ({ success, data: { alerts, pagination } }).
        const resp = await alertService.getAlerts({ limit: 50, isResolved: false });
        if (!mounted) return;
        if (resp && resp.data && resp.data.success) {
          // resp.data.data is the paginated payload; it may contain 'alerts' or be an array
          const payload = resp.data.data as any;
          const items = Array.isArray(payload) ? payload : (Array.isArray(payload.alerts) ? payload.alerts : []);
          setAlerts(items);
        }
      } catch (e) {
        // ignore
      }
    }

    async function loadHealth() {
      try {
        const res = await fetch('/api/health');
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setHealthStatus(data);
        }
      } catch (e) { setHealthStatus(null); }
    }

    loadLatest(); loadAlerts(); loadHealth(); loadReminders(); loadLatestAlerts();
    // load devices
    (async function loadDevices() {
      try {
        const res = await fetch('/api/devices');
        if (res.ok) {
          const body = await res.json();
          const list = Array.isArray(body.data) ? body.data : (Array.isArray(body) ? body : []);
          setDevicesOnline(Array.isArray(list) ? list.filter((d:any) => d.status === 'online').length : 0);
        }
      } catch (e) {
        setDevicesOnline(0);
      }
    })();
    // also fetch initial history for charts
    (async function loadHistory() {
      try {
        const h = await fetch('/api/sensors/history?limit=200');
        if (h.ok) {
          const body = await h.json().catch(() => ({}));
          const items = Array.isArray(body.data?.sensorData) ? body.data.sensorData : (Array.isArray(body) ? body : []);
          if (items && items.length) {
            setSensorHistory(items.slice(0,200).reverse());
          }
        }
      } catch (e) {
        // ignore
      }
    })();
    const id1 = setInterval(loadLatest, 5000);
    const id2 = setInterval(loadAlerts, 15000);
    const id3 = setInterval(loadHealth, 10000);
    const id4 = setInterval(loadReminders, 60_000);
    const id5 = setInterval(loadLatestAlerts, 10000); // Poll for new alerts every 10 seconds
    return () => { mounted = false; clearInterval(id1); clearInterval(id2); clearInterval(id3); clearInterval(id4); clearInterval(id5); };
  }, []);

  useEffect(() => {
    if (latestSensor) {
      setSensorStatus('Sensor successfully connected');
    } else {
      setSensorStatus('No sensors connected');
    }
  }, [latestSensor]);

  // (User management removed) 

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter(a => (a.title || '').toLowerCase().includes(q) || (a.message || '').toLowerCase().includes(q));
  }, [alerts, query]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ type: string; id: string; title: string; subtitle?: string }> = [];
    results.push(...alerts.filter(a => (a.title || '').toLowerCase().includes(q) || (a.message || '').toLowerCase().includes(q)).map(a => ({ type: 'alert', id: String(a.id), title: a.title, subtitle: new Date(a.createdAt).toLocaleString() })));
    if (latestSensor && ((latestSensor.name || '').toLowerCase().includes(q) || (latestSensor.deviceId || '').toLowerCase().includes(q))) {
      results.push({ type: 'sensor', id: latestSensor.id || 'latest', title: latestSensor.name || latestSensor.deviceId || 'Sensor', subtitle: 'Latest reading' });
    }
    return results.slice(0, 12);
  }, [searchQuery, alerts, latestSensor]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
      if (e.key === '/' && !(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'))) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function loadWeather() {
    try { const sum = await weatherService.getManilaWeatherSummary(); setWeatherSummary(sum); } catch (e) { setWeatherSummary(null); }
  }

  // Fetch alerts/events on demand (used by the Events card)
  async function fetchEvents() {
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
      setAlerts(list);
    } catch (e) {
      // ignore errors for now
    }
  }

  // Compute vermitea production counter from waterLevel deltas in history
  const vermiteaLiters = useMemo(() => {
    // assume waterLevel is integer representing mm of water or sensor level; convert delta to liters using tank cross-section
    // this is heuristic: if waterLevel drops, that's liters produced; use tankAreaLitersPerUnit as calibration
    const tankAreaLitersPerUnit = 0.5; // liters per waterLevel unit (configurable in settings)
    if (!sensorHistory || sensorHistory.length < 2) return 0;
    let liters = 0;
    for (let i = 1; i < sensorHistory.length; i++) {
      const prev = sensorHistory[i-1].waterLevel ?? null;
      const cur = sensorHistory[i].waterLevel ?? null;
      if (prev != null && cur != null && prev > cur) {
        liters += (prev - cur) * tankAreaLitersPerUnit;
      }
    }
    return Math.round(liters * 10) / 10;
  }, [sensorHistory]);

  // Portal header to document.body so it is never affected by parent transforms/scroll containers
  const AdminHeader: React.FC = () => {
    React.useEffect(() => {
      document.body.classList.add('has-admin-header');
      return () => document.body.classList.remove('has-admin-header');
    }, []);

    return createPortal(
      <HeaderFrame
        className="admin-fixed"
        titleSuffix="Admin"
        subtitle="Environmental Monitoring System"
        badgeLabel="Admin Dashboard"
        badgeTone="emerald"
        contextTag={(
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            System Online
          </div>
        )}
        rightSlot={(
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
            <div className="hidden lg:flex items-center gap-3 text-sm text-coffee-500 dark:text-slate-200">
              <StatusPill label="Server" status={systemStatus.server} />
              <StatusPill label="DB" status={systemStatus.database} />
              <div className="flex items-center gap-1">
                <span className="font-medium">Latency:</span>
                <span>{systemStatus.apiLatency}ms</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                title="Logout"
                onClick={() => setShowLogoutConfirm(true)}
                className="rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-medium text-coffee-700 transition-colors hover:border-coffee-300 hover:text-coffee-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                Logout
              </button>
              <DarkModeToggle />
            </div>
          </div>
        )}
      />,
      document.body
    );
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'monitoring' | 'management' | 'reports'>('overview');
  const [activeSubTab, setActiveSubTab] = useState<'thresholds' | 'alerts' | 'diagnostics' | 'sensors'>('thresholds');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();

  const LogoutConfirmModal: React.FC = () => {
    if (!showLogoutConfirm) return null;
    return createPortal(
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowLogoutConfirm(false)} />
        <div className="relative z-70 bg-white dark:bg-gray-900 rounded-xl shadow-lg border p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Confirm Logout</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Are you sure you want to logout?</p>
            <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setShowLogoutConfirm(false)} className="px-3 py-2 rounded-md border">No</button>
            <button onClick={() => { setShowLogoutConfirm(false); logout(); navigate('/admin/login'); }} className="px-3 py-2 rounded-md bg-red-600 text-white">Yes, logout</button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // Maintenance reminders handled in top-of-file declarations

  const chartData = sensorHistory.map((s, i) => ({ time: `${i * 5}s`, temperature: s.temperature ?? 0, humidity: s.humidity ?? 0, moisture: s.moisture ?? 0, ph: s.ph ?? 0, ec: s.ec ?? 0, waterLevel: s.waterLevel ?? 0 }));

  return (
    <div className="min-h-screen pt-24 p-6 bg-gray-50 dark:bg-gray-900">
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search alerts, sensors... (Press Esc to close)" className="w-full px-4 py-3 rounded-lg border text-sm bg-gray-50 dark:bg-gray-900/60" />
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="px-3 py-2 text-sm rounded-md border">Close</button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto border-t border-gray-100 dark:border-gray-700 p-4">
              {searchResults.length === 0 && <div className="text-sm text-gray-500">No results</div>}
              {searchResults.map(r => (
                <div key={`${r.type}-${r.id}`} className="py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500">{r.type} • {r.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
  {/* header rendered to body via portal (AdminHeader) */}
  <AdminHeader />
  {/* Logout confirmation modal (portal) */}
  <LogoutConfirmModal />

  {/* header is fixed via CSS; top padding on the root container prevents overlap */}

  {/* header is fixed via CSS; top padding on the root container prevents overlap */}

      <main className="relative max-w-7xl mx-auto space-y-6">
        {/* Background accent */}
        <div className="pointer-events-none absolute -top-20 left-1/2 transform -translate-x-1/2 w-[1100px] h-[300px] bg-gradient-to-r from-rose-200 via-yellow-100 to-indigo-100 opacity-30 blur-3xl rounded-full dark:opacity-20" />

        {/* Main Navigation Tabs */}
        <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-600">
            <nav className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('devices')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'devices'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Settings className="w-4 h-4" />
                Devices
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'monitoring'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Activity className="w-4 h-4" />
                Monitoring
              </button>
              <button
                onClick={() => setActiveTab('management')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'management'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Users className="w-4 h-4" />
                Management
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'reports'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Reports
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Hero Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`${cardClass} rounded-2xl flex flex-col items-start gap-2`}>
                    <div className="text-xs text-gray-500">Current Temperature</div>
                    <div className="text-4xl md:text-5xl font-extrabold text-rose-600">{latestSensor?.temperature != null ? `${latestSensor.temperature}°C` : '--'}</div>
                    <div className="text-sm text-gray-500">Sensor: <span className="font-medium">{latestSensor?.name ?? latestSensor?.deviceId ?? '—'}</span></div>
                  </div>
                  <div className={`${cardClass} rounded-2xl flex flex-col items-start gap-2`}>
                    <div className="text-xs text-gray-500">Humidity</div>
                    <div className="text-4xl md:text-5xl font-extrabold text-sky-600">{latestSensor?.humidity != null ? `${latestSensor.humidity}%` : '--'}</div>
                    <div className="text-sm text-gray-500">Last seen: <span className="font-medium">{fmtLastSeen(latestSensor?.lastSeen)}</span></div>
                  </div>
                  <div className={`${cardClass} rounded-2xl flex flex-col items-start gap-2`}>
                    <div className="text-xs text-gray-500">Soil Moisture</div>
                    <div className="text-4xl md:text-5xl font-extrabold text-green-600">{latestSensor?.moisture != null ? `${latestSensor.moisture}%` : '--'}</div>
                    <div className="text-sm text-gray-500">Water Level: <span className="font-medium">{latestSensor?.waterLevel ?? '—'}</span></div>
                  </div>
                </div>

                {/* System Overview & Notifications Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* System Health */}
                  <div className="p-4 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
                    <SystemHealth items={[
                      { label: 'Server', ok: systemStatus.server === 'online', details: `${systemStatus.apiLatency}ms` },
                      { label: 'Database', ok: systemStatus.database === 'online' },
                      { label: 'ESP32s', ok: !!latestSensor },
                      { label: 'Cloud API', ok: !!weatherSummary }
                    ]} />
                  </div>

                  {/* Notifications */}
                  <div className="p-4 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center">
                        <Bell className="w-5 h-5 mr-2" />
                        Notifications
                        {unreadCount > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {latestAlerts.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-4">No notifications</div>
                      ) : (
                        latestAlerts.map((alert: any) => (
                          <div key={alert._id} className={`p-3 rounded-lg border ${
                            alert.status === 'new'
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                          }`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    alert.status === 'new'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                  }`}>
                                    {alert.type}
                                  </span>
                                  {alert.status === 'new' && (
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-800 dark:text-gray-200">{alert.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(alert.createdAt).toLocaleString()}
                                </p>
                              </div>
                              {alert.status === 'new' && (
                                <button
                                  onClick={() => markAlertAsRead(alert._id)}
                                  className="ml-2 p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                  title="Mark as read"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Latest Sensor Data */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Latest Sensor Data</h3>
                    <div className="text-sm text-gray-500">Updated: <span className="font-medium">{latestSensor ? fmtLastSeen(latestSensor.lastSeen) : '--'}</span></div>
                  </div>

                  {latestSensor ? (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      <SensorCard id="temp" label="Temperature" value={latestSensor?.temperature ?? null} unit="°C" icon={<span>🌡️</span>} thresholds={{ ok: [18,30], warn: [15,18], critical: [0,14] }} hint="Optimal 18–30°C" alert={alerts.some(a => (a.type || a._id || '').toString() === 'temperature' && !a.acknowledged)} />
                      <SensorCard id="humidity" label="Humidity" value={latestSensor?.humidity ?? null} unit="%" icon={<span>💧</span>} thresholds={{ ok: [40,70], warn: [30,40], critical: [0,29] }} hint="Optimal 40–70%" alert={alerts.some(a => (a.type || a._id || '').toString() === 'humidity' && !a.acknowledged)} />
                      <SensorCard id="moisture" label="Soil Moisture" value={latestSensor?.moisture ?? null} unit="%" icon={<span>🪴</span>} thresholds={{ ok: [30,60], warn: [15,29], critical: [0,14] }} hint="Keep moisture >30%" alert={alerts.some(a => (a.type || a._id || '').toString() === 'moisture' && !a.acknowledged)} />
                      <SensorCard id="ph" label="pH" value={latestSensor?.ph ?? null} unit="" icon={<span>⚗️</span>} thresholds={{ ok: [6,8], warn: [5,6], critical: [0,4] }} hint="Target pH 6–8" alert={alerts.some(a => (a.type || a._id || '').toString() === 'ph' && !a.acknowledged)} />
                      <SensorCard id="ec" label="EC (µS/cm)" value={latestSensor?.ec ?? null} unit="µS/cm" icon={<span>🔌</span>} hint="Electrical Conductivity" alert={alerts.some(a => a.type === 'ec' && !a.acknowledged)} />
                      <SensorCard id="npk" label="NPK (mg/kg)" value={latestSensor?.npk?.n ?? null} unit="mg/kg" icon={<span>🧪</span>} hint="NPK sample (show N)" alert={alerts.some(a => ['nitrogen','phosphorus','potassium'].includes(String(a.type)) && !a.acknowledged)} />
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">No sensors connected — no data available.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Devices Tab */}
            {activeTab === 'devices' && (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Device Management</h3>
                  <p className="text-gray-600 dark:text-gray-400">Manage and monitor your environmental sensors</p>
                </div>
                <DeviceManagement />
              </div>
            )}

            {/* Monitoring Tab */}
            {activeTab === 'monitoring' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">System Monitoring</h3>
                  <p className="text-gray-600 dark:text-gray-400">Configure thresholds, manage alerts, and monitor system diagnostics</p>
                </div>

                <ActuatorControls />

                {/* Sub-tabs for monitoring */}
                <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg shadow">
                  <div className="border-b border-gray-200 dark:border-gray-600">
                    <nav className="flex overflow-x-auto">
                      <button
                        onClick={() => setActiveSubTab('thresholds')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                          activeSubTab === 'thresholds'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        <Activity className="w-4 h-4 inline mr-2" />
                        Thresholds
                      </button>
                      <button
                        onClick={() => setActiveSubTab('alerts')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                          activeSubTab === 'alerts'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        <Bell className="w-4 h-4 inline mr-2" />
                        Alerts
                      </button>
                      <button
                        onClick={() => setActiveSubTab('diagnostics')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                          activeSubTab === 'diagnostics'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 inline mr-2" />
                        Diagnostics
                      </button>
                    </nav>
                  </div>

                  <div className="p-4 max-h-96 overflow-y-auto">
                    {activeSubTab === 'thresholds' && <ThresholdConfiguration />}
                    {activeSubTab === 'alerts' && (
                      <div className="space-y-6">
                        {/* Alert Configuration */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Alert Configuration</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <label className="flex items-center space-x-2">
                                <input type="checkbox" defaultChecked className="rounded" />
                                <span className="text-sm">Enable Temperature Alerts</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <input type="checkbox" defaultChecked className="rounded" />
                                <span className="text-sm">Enable Humidity Alerts</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <input type="checkbox" defaultChecked className="rounded" />
                                <span className="text-sm">Enable Moisture Alerts</span>
                              </label>
                            </div>
                            <div className="space-y-3">
                              <label className="flex items-center space-x-2">
                                <input type="checkbox" defaultChecked className="rounded" />
                                <span className="text-sm">Enable pH Alerts</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <input type="checkbox" defaultChecked className="rounded" />
                                <span className="text-sm">Enable System Alerts</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <input type="checkbox" className="rounded" />
                                <span className="text-sm">Email Notifications</span>
                              </label>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-3">
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
                              Save Configuration
                            </button>
                            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500">
                              Reset to Default
                            </button>
                          </div>
                        </div>

                        {/* Active Alerts */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Active Alerts</h4>
                            <div className="flex gap-2">
                              <button
                                onClick={loadLatestAlerts}
                                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                              >
                                Refresh
                              </button>
                              <button className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800/30">
                                Clear All
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {devicesOnline === 0 ? (
                              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Awaiting live data — no devices are online</p>
                                <p className="text-sm">Connect an ESP32 unit to begin receiving live alerts</p>
                              </div>
                            ) : latestAlerts.length === 0 ? (
                              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>No active alerts</p>
                                <p className="text-sm">All systems are operating normally</p>
                              </div>
                            ) : (
                              latestAlerts.map((alert: any) => (
                                <div key={alert._id} className={`p-4 rounded-lg border ${
                                  alert.status === 'new'
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                                }`}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          alert.status === 'new'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                        }`}>
                                          {alert.type || 'System'}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                          alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-blue-100 text-blue-800'
                                        }`}>
                                          {alert.severity || 'info'}
                                        </span>
                                        {alert.status === 'new' && (
                                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                        )}
                                      </div>
                                      <h5 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                                        {alert.title || alert.message?.split('.')[0] || 'Alert'}
                                      </h5>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {alert.message}
                                      </p>
                                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                                        <span>Created: {new Date(alert.createdAt).toLocaleString()}</span>
                                        {alert.deviceId && <span>Device: {alert.deviceId}</span>}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2 ml-4">
                                      {alert.status === 'new' && (
                                        <button
                                          onClick={() => markAlertAsRead(alert._id)}
                                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                          title="Mark as read"
                                        >
                                          Acknowledge
                                        </button>
                                      )}
                                      <button className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-500">
                                        Details
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Alert History */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Alert History</h4>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                              <p>Alert history will be displayed here</p>
                              <p className="text-sm">Historical alerts and trends coming soon</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeSubTab === 'diagnostics' && <SystemDiagnostics />}
                  </div>
                </div>
              </div>
            )}

            {/* Management Tab */}
            {activeTab === 'management' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">System Management</h3>
                  <p className="text-gray-600 dark:text-gray-400">Manage sensor configurations</p>
                </div>

                {/* Sub-tabs for management */}
                <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg shadow">
                  <div className="border-b border-gray-200 dark:border-gray-600">
                    <nav className="flex overflow-x-auto">
                      <button
                        onClick={() => setActiveSubTab('sensors')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                          activeSubTab === 'sensors'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        <Settings className="w-4 h-4 inline mr-2" />
                        Sensors
                      </button>
                    </nav>
                  </div>

                  <div className="p-4 max-h-96 overflow-y-auto">
                    {activeSubTab === 'sensors' && (
                      <div className="space-y-4">
                        <div className="text-center py-8">
                          <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Sensor Configuration</h3>
                          <p className="text-gray-600 dark:text-gray-400">Advanced sensor settings and calibration</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">Sensor Status</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{sensorStatus}</p>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">Add New Sensor</h4>
                            <button onClick={addSensor} disabled={isAddingSensor} className="w-full px-4 py-2 text-sm rounded-md bg-green-600 text-white disabled:opacity-50">
                              {isAddingSensor ? 'Adding...' : 'Add Sensor'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Reports & Analytics</h3>
                  <p className="text-gray-600 dark:text-gray-400">View reports, analytics, and system maintenance information</p>
                </div>

                {/* Reports & Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow flex flex-col justify-between min-h-[200px]">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Reports & Analytics</h3>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{vermiteaLiters.toFixed(1)}L</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Vermitea Produced</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{filteredAlerts.length}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Active Alerts</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Compost production, vermitea output, irrigation history and sensor calibration logs.</p>
                    </div>
                    <div className="mt-4 flex gap-3 items-end">
                      <button title="Export as PDF" onClick={() => window.print()} className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white">Export PDF</button>
                      <button title="Export as CSV" onClick={async () => { await loadActuatorLogs(); const rows = sensorHistory.map(s => ({ timestamp: (s as any).timestamp || new Date().toISOString(), deviceId: s.deviceId || '', temperature: s.temperature ?? '', humidity: s.humidity ?? '', moisture: s.moisture ?? '', ph: s.ph ?? '', ec: s.ec ?? '', waterLevel: s.waterLevel ?? '' })); const csv = [['timestamp','deviceId','temperature','humidity','moisture','ph','ec','waterLevel'], ...rows.map(r => [r.timestamp, r.deviceId, r.temperature, r.humidity, r.moisture, r.ph, r.ec, r.waterLevel])].map(r => r.join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sensor-history.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700">Export CSV</button>
                    </div>
                  </div>

                  {/* System Health Monitor */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">System Health Monitor</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Server Status</span>
                          <span className={`px-2 py-1 rounded text-xs ${systemStatus.server === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {systemStatus.server}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Database</span>
                          <span className={`px-2 py-1 rounded text-xs ${systemStatus.database === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {systemStatus.database}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-sm text-gray-600 dark:text-gray-400">API Latency</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{systemStatus.apiLatency}ms</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Sensors</span>
                          <span className={`px-2 py-1 rounded text-xs ${latestSensor ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {latestSensor ? 'Connected' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Weather API</span>
                          <span className={`px-2 py-1 rounded text-xs ${weatherSummary ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {weatherSummary ? 'Available' : 'Limited'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sensor Management */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow flex flex-col justify-between min-h-[200px]">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Sensor Management</h3>
                      <p className="text-sm text-gray-600">Add and manage connected sensors.</p>
                      <p className="text-sm text-gray-500 mt-1">{sensorStatus}</p>
                    </div>
                    <div className="mt-4">
                      <button onClick={addSensor} disabled={isAddingSensor} title="Add a new sensor" className="w-full px-4 py-2 text-sm rounded-md bg-green-600 text-white disabled:opacity-50">
                        {isAddingSensor ? 'Adding...' : 'Add Sensors'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Events & Activity Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* System Events & Maintenance */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">System Events & Maintenance</h3>
                        <p className="text-sm text-gray-600">Latest system events and upcoming maintenance reminders.</p>
                      </div>
                      <button onClick={fetchEvents} title="Refresh events" className="px-3 py-2 rounded-md border bg-gray-50 dark:bg-gray-800 text-sm">Refresh</button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="border rounded-md p-3 bg-white dark:bg-gray-900 max-h-40 overflow-auto">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Latest Events</div>
                          <div className="text-xs text-gray-500">Showing up to 5</div>
                        </div>
                        {alerts.length === 0 && <div className="text-sm text-gray-500">No recent events</div>}
                        {alerts.slice(0,5).map(a => (
                          <div key={a.id} className="py-2 border-b last:border-b-0 flex items-start gap-3">
                            <div className={`w-3 h-3 mt-1 rounded-full ${a.severity === 'critical' ? 'bg-red-600' : a.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'}`} />
                            <div>
                              <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{a.title}</div>
                              <div className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border rounded-md p-3 bg-white dark:bg-gray-900">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Maintenance Reminders</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span title="Quick actions">⚡ 🛠️</span>
                            <button onClick={loadReminders} className="px-2 py-1 rounded-md border text-xs">Refresh</button>
                          </div>
                        </div>
                        {remindersLoading && <div className="text-sm text-gray-500">Loading reminders...</div>}
                        {!remindersLoading && reminders.length === 0 && (
                          <div className="text-sm text-gray-500">No maintenance reminders configured.</div>
                        )}

                        <ul className="text-sm text-gray-600 space-y-2 max-h-32 overflow-auto">
                          {reminders.map(r => (
                            <li key={r.id} className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{r.title}</div>
                                <div className="text-xs text-gray-500">Due in: <span className="font-medium">{r.dueInDays ?? '-'} days</span></div>
                                {r.note && <div className="text-xs text-gray-500">{r.note}</div>}
                              </div>
                              <div className="flex flex-col items-end gap-2 ml-2">
                                {!r.acknowledged ? (
                                  <button onClick={() => acknowledgeReminder(r.id)} className="px-2 py-1 rounded-md bg-green-600 text-white text-xs">Acknowledge</button>
                                ) : (
                                  <div className="text-xs text-green-600">Acknowledged</div>
                                )}
                                <button onClick={() => scheduleReminder(r.id)} className="px-2 py-1 rounded-md border text-xs">Schedule</button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Recent Activity</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {alerts.slice(0,8).map(a => (
                        <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-b-0">
                          <div className={`w-3 h-3 mt-1 rounded-full ${a.severity === 'critical' ? 'bg-red-600' : a.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'}`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{a.title}</div>
                            <div className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                      {alerts.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No recent activity</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
  {/* remove FAB for Gary-Sheng clean layout */}
    </div>
  );
}

