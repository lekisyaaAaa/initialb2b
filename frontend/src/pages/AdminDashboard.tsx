import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Leaf } from 'lucide-react';
import SensorCharts from '../components/SensorCharts';
import SystemHealth from '../components/SystemHealth';
import SensorCard from '../components/SensorCard';
import AlertsPanel from '../components/AlertsPanel';
import ActuatorControls from '../components/ActuatorControls';
import DarkModeToggle from '../components/DarkModeToggle';
import { useAuth } from '../contexts/AuthContext';
import weatherService from '../services/weatherService';

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

type Alert = { id: string; title: string; severity: 'info' | 'warning' | 'critical'; message?: string; createdAt: string; acknowledged?: boolean };

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
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Maintenance reminders state (populated from backend)
  const [reminders, setReminders] = useState<Array<any>>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);

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

  // Search UI state

  function fmtLastSeen(iso?: string | null) { if (!iso) return 'No data'; try { return new Date(iso).toLocaleString(); } catch { return String(iso); } }

  useEffect(() => {
    let mounted = true;
    async function loadLatest() {
      try {
        const start = Date.now();
        const res = await fetch('/api/sensors/latest');
        const end = Date.now();
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const s = data && data.data ? (data.data as Sensor) : null;
          if (s) {
            setLatestSensor(s);
            setSensorHistory(prev => [...prev.slice(-199), s]);
            setSystemStatus(prev => ({ ...prev, server: 'online', database: 'online', apiLatency: end - start }));
          }
        } else {
          setSystemStatus(prev => ({ ...prev, server: 'offline', apiLatency: end - start }));
        }
      } catch (e) {
        setSystemStatus(prev => ({ ...prev, server: 'offline', database: 'offline', apiLatency: 0 }));
      }
    }

    async function loadAlerts() {
      try {
        const res = await fetch('/api/alerts');
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setAlerts(Array.isArray(data) ? data : []);
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

    loadLatest(); loadAlerts(); loadHealth(); loadReminders();
    const id1 = setInterval(loadLatest, 5000);
    const id2 = setInterval(loadAlerts, 15000);
    const id3 = setInterval(loadHealth, 10000);
    const id4 = setInterval(loadReminders, 60_000);
    return () => { mounted = false; clearInterval(id1); clearInterval(id2); clearInterval(id3); clearInterval(id4); };
  }, []);

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

  // Portal header to document.body so it is never affected by parent transforms/scroll containers
  const AdminHeader: React.FC = () => {
    React.useEffect(() => {
      document.body.classList.add('has-admin-header');
      return () => { document.body.classList.remove('has-admin-header'); };
    }, []);

    return createPortal(
      (
        <header className="admin-fixed bg-gradient-to-r from-white via-coffee-50 to-white dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 shadow-xl border-b border-coffee-200/50 dark:border-gray-700/50 backdrop-blur-sm bg-opacity-95" role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <a href="/" className="group relative">
                  <div className="letran-coffee-gradient rounded-xl p-3 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group-hover:rotate-3">
                    <Leaf className="h-7 w-7 text-white drop-shadow-sm" />
                  </div>
                </a>

                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <h1 className="site-title dark:site-title text-2xl font-bold">
                      Bean<span className="site-accent bg-gradient-to-r from-teal-500 to-purple-600 bg-clip-text text-transparent">To</span>Bin
                    </h1>
                    <div className="hidden sm:flex items-center space-x-1">
                      <div className="live-indicator">
                        <div className="pulse-dot"></div>
                        <span>Admin</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 mt-1">
                    <p className="site-subtitle text-sm font-medium">Environmental Monitoring System</p>
                    <div className="site-badge bg-gradient-to-r from-teal-50 to-purple-50 dark:from-teal-900/20 dark:to-purple-900/20 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300 shadow-sm">
                      <span>Admin Dashboard</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="hidden md:flex items-center space-x-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-full border border-green-200 dark:border-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">System Online</span>
                </div>

                <div className="hidden lg:flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Server:</span>
                    <span className={systemStatus.server === 'online' ? 'text-green-600' : 'text-red-600'}>{systemStatus.server}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                    <span className="font-medium">DB:</span>
                    <span className={systemStatus.database === 'online' ? 'text-green-600' : 'text-red-600'}>{systemStatus.database}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Latency:</span>
                    <span>{systemStatus.apiLatency}ms</span>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <button title="Logout" onClick={() => { logout(); window.location.href = '/login'; }} className="px-3 py-2 rounded-lg border bg-gray-100 dark:bg-gray-800 text-sm">Logout</button>
                  <DarkModeToggle />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-teal-300 dark:via-teal-600 to-transparent opacity-50"></div>
        </header>
      ),
      document.body
    );
  };

  // Maintenance reminders handled in top-of-file declarations

  async function controlActuator(actuator: 'pump' | 'solenoid', state: boolean) {
    try { await fetch('/api/actuators/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actuator, state }) }); } catch (e) { /* ignore */ }
  }

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

  {/* header is fixed via CSS; top padding on the root container prevents overlap */}

      <main className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Background accent */}
        <div className="pointer-events-none absolute -top-20 left-1/2 transform -translate-x-1/2 w-[1100px] h-[300px] bg-gradient-to-r from-rose-200 via-yellow-100 to-indigo-100 opacity-30 blur-3xl rounded-full dark:opacity-20" />
        {/* Left column: System health, alerts, actuators */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
            <SystemHealth items={[
              { label: 'Server', ok: systemStatus.server === 'online', details: `${systemStatus.apiLatency}ms` },
              { label: 'Database', ok: systemStatus.database === 'online' },
              { label: 'ESP32s', ok: !!latestSensor },
              { label: 'Cloud API', ok: !!weatherSummary }
            ]} />
          </div>

          <div className="p-4 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
            <AlertsPanel alerts={filteredAlerts.slice(0,6).map(a => ({ id: a.id, title: a.title, severity: a.severity }))} onAcknowledge={(id)=>{ setAlerts(prev => prev.map(x => x.id===id ? { ...x, acknowledged: true } : x)); }} onDismiss={(id)=>{ setAlerts(prev => prev.filter(x => x.id!==id)); }} />
          </div>

          <div className="p-4 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
            <ActuatorControls className="w-full" />
          </div>
        </div>

        {/* Center column: Overview, Latest Sensor Data, Charts */}
        <div className="space-y-6">
          {/* Hero metrics - prominent, immediate values for Hakim-like visual impact */}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 min-h-[84px]">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Overview</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-1">
                <div className="text-sm text-gray-500">Active Alerts</div>
                <div className="text-2xl font-bold text-red-600">{filteredAlerts.length}</div>
              </div>
              <div className="col-span-1">
                <div className="text-sm text-gray-500">Current Temp</div>
                <div className="text-2xl font-bold">{latestSensor?.temperature != null ? `${latestSensor.temperature}°C` : '--'}</div>
              </div>
              <div className="col-span-1">
                <div className="text-sm text-gray-500">Uptime / Latency</div>
                <div className="text-2xl font-bold">{healthStatus?.uptime ?? `${systemStatus.apiLatency}ms`}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Latest Sensor Data</h3>
              <div className="text-sm text-gray-500">Updated: <span className="font-medium">{latestSensor ? fmtLastSeen(latestSensor.lastSeen) : '--'}</span></div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <SensorCard id="temp" label="Temperature" value={latestSensor?.temperature ?? null} unit="°C" icon={<span>🌡️</span>} thresholds={{ ok: [18,30], warn: [15,18], critical: [0,14] }} hint="Optimal 18–30°C" />
              <SensorCard id="humidity" label="Humidity" value={latestSensor?.humidity ?? null} unit="%" icon={<span>💧</span>} thresholds={{ ok: [40,70], warn: [30,40], critical: [0,29] }} hint="Optimal 40–70%" />
              <SensorCard id="moisture" label="Soil Moisture" value={latestSensor?.moisture ?? null} unit="%" icon={<span>🪴</span>} thresholds={{ ok: [30,60], warn: [15,29], critical: [0,14] }} hint="Keep moisture >30%" />
              <SensorCard id="ph" label="pH" value={latestSensor?.ph ?? null} unit="" icon={<span>⚗️</span>} thresholds={{ ok: [6,8], warn: [5,6], critical: [0,4] }} hint="Target pH 6–8" />
              <SensorCard id="ec" label="EC (µS/cm)" value={latestSensor?.ec ?? null} unit="µS/cm" icon={<span>🔌</span>} hint="Electrical Conductivity" />
              <SensorCard id="npk" label="NPK (mg/kg)" value={latestSensor?.npk?.n ?? null} unit="mg/kg" icon={<span>🧪</span>} hint="NPK sample (show N)" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sensor History</h3>
            <div className="mt-3">
              <SensorCharts data={chartData} keys={[ 'temperature','humidity','moisture','ph','ec','waterLevel' ]} />
            </div>
          </div>
        </div>

        {/* Right column: Reports, User management, Recent activity */}
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow flex flex-col justify-between min-h-[140px]">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Reports & Logs</h3>
              <p className="text-sm text-gray-600">Compost production, vermitea output, irrigation history and sensor calibration logs will appear here.</p>
            </div>
            <div className="mt-4 flex gap-3 items-end">
              <button title="Export as PDF" className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white">Export PDF</button>
              <button title="Export as CSV" className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700">Export CSV</button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow min-h-[160px]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">System Events & Maintenance</h3>
                <p className="text-sm text-gray-600">Latest system events and upcoming maintenance reminders. Shows recent events (up to 5) and action items.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={fetchEvents} title="Refresh events" className="px-3 py-2 rounded-md border bg-gray-50 dark:bg-gray-800 text-sm">Refresh</button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="border rounded-md p-2 bg-white dark:bg-gray-900 max-h-36 overflow-auto">
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

              <div className="border rounded-md p-2 bg-white dark:bg-gray-900">
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

                <ul className="text-sm text-gray-600 space-y-2">
                  {reminders.map(r => (
                    <li key={r.id} className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{r.title}</div>
                        <div className="text-xs text-gray-500">Due in: <span className="font-medium">{r.dueInDays ?? '-'} days</span></div>
                        {r.note && <div className="text-xs text-gray-500">{r.note}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-2">
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

          <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow min-h-[140px]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Recent Activity</h3>
            <div className="text-sm text-gray-600">
              {alerts.slice(0,6).map(a => (
                <div key={a.id} className="flex items-start gap-2 py-1">
                  <div className={`w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-red-600' : a.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-400'}`} />
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
  {/* remove FAB for Gary-Sheng clean layout */}
    </div>
  );
}

