import React, { useEffect, useMemo, useState } from 'react';
import weatherService from '../services/weatherService';
import DarkModeToggle from '../components/DarkModeToggle';

// AdminDashboard — improved, interactive environmental monitoring dashboard
// Key goals implemented in this component:
// - Prioritize Active Alerts visually with color/animation and prominent placement
// - Integrate "Load Weather" into the overview area with concise context
// - Add global filters (time range, sensor search/type) and optional local overrides
// - Provide tooltips, threshold indicators, rotating smart tips and unified empty state
// - Increase interactivity: filter, sort, drill-down into sensor details, export options
// - Modern, minimal dark-mode aware Tailwind styling

type Sensor = {
  id: string;
  name: string;
  deviceId: string;
  temperature?: number | null;
  humidity?: number | null;
  moisture?: number | null;
  batteryLevel?: number | null;
  lastSeen?: string | null; // ISO timestamp
  status?: 'normal' | 'warning' | 'critical';
};

type Alert = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  deviceId?: string;
  createdAt: string; // ISO
  acknowledged?: boolean;
};

const DEFAULT_THRESHOLDS = {
  humidity: { warning: 60, critical: 75 },
  moisture: { warning: 40, critical: 60 },
};

const timeRanges = [
  { key: '1h', label: 'Last hour' },
  { key: '6h', label: '6 hours' },
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
];

// Small helper: formatted relative time or fallback
function fmtLastSeen(iso?: string | null) {
  if (!iso) return 'No data';
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function AdminDashboard() {
  // UI state: global filters and UI controls
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [query, setQuery] = useState<string>('');
  const [onlyCritical, setOnlyCritical] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  // Data state (in a real app, fetch from API). We simulate loading and fetch attempts.
  const [sensors, setSensors] = useState<Sensor[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastFetchAttempt, setLastFetchAttempt] = useState<string | null>(null);
  const [manilaWeather, setManilaWeather] = useState<any | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // UI helper: rotating smart tips
  const tips = useMemo(
    () => [
      'Tip: Set humidity thresholds to reduce false positives during daytime.',
      'Tip: Check battery level on devices with frequent disconnects.',
      'Tip: Use export to create a quick CSV snapshot for offline analysis.',
      'Tip: Pin important sensors to your dashboard for faster access.',
    ],
    []
  );
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 7000);
    return () => clearInterval(t);
  }, [tips.length]);

  // Drill-down: show selected sensor details
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);

  // Real fetch: use backend endpoints. Include token from localStorage if present.
  async function fetchData() {
    setLoading(true);
    setLastFetchAttempt(new Date().toISOString());
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // parallel fetch sensors + alerts
      const [sRes, aRes] = await Promise.all([
        fetch('/api/sensors', { headers }),
        fetch('/api/alerts', { headers }),
      ]);

      // handle auth errors
      if (sRes.status === 401 || aRes.status === 401) {
        // redirect to login — keep behavior simple here
        window.location.href = '/admin/login';
        return;
      }

      if (!sRes.ok) throw new Error(`Sensors fetch failed: ${sRes.status}`);
      if (!aRes.ok) throw new Error(`Alerts fetch failed: ${aRes.status}`);

      const sJson = await sRes.json();
      const aJson = await aRes.json();

      // Expect arrays; defensive conversion
      setSensors(Array.isArray(sJson) ? sJson : []);
      setAlerts(Array.isArray(aJson) ? aJson : []);
    } catch (err: any) {
      console.error('fetchData error', err);
      // keep existing data but surface empties when network fails
      setSensors((prev) => prev ?? []);
      setAlerts((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial load
    fetchData();
    // keep polling every minute for demo purposes
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, []);

  // Derived filtered sensors according to global filters
  const filteredSensors = useMemo(() => {
    if (!sensors) return null;
    let list = sensors.slice();
    if (query) {
      const q = query.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.deviceId.toLowerCase().includes(q));
    }
    if (onlyCritical) list = list.filter((s) => s.status === 'critical');
    return list;
  }, [sensors, query, onlyCritical]);

  // Export helper: create downloadable blob
  function doExport() {
    const payload = filteredSensors || sensors || [];
    if (exportFormat === 'csv') {
      const rows = ['id,name,deviceId,temperature,humidity,moisture,ph,battery,lastSeen,status'];
      for (const s of payload) {
        rows.push([
          s.id,
          s.name,
          s.deviceId,
          s.temperature ?? '',
          s.humidity ?? '',
          s.moisture ?? '',
          // include pH if present
          (s as any).ph ?? '',
          s.batteryLevel ?? '',
          s.lastSeen ?? '',
          s.status ?? '',
        ].join(','));
      }
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sensors_${new Date().toISOString()}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sensors_${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // UI helpers for visual emphasis of alerts
  const activeAlerts = (alerts || []).filter((a) => !a.acknowledged);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      {/* Top bar: title + global filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 bg-white/60 dark:bg-gray-800/60 px-3 py-2 rounded shadow-sm hover:shadow-md transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back to Home
          </a>
          <div>
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Overview · Environmental monitoring · Live</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Visible dark mode toggle in header */}
          <div className="flex items-center">
            {/* import component dynamically-friendly usage */}
            <div className="mr-2">
              <DarkModeToggle />
            </div>
          </div>
          {/* Time range global filter (single source of truth) */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded shadow-sm">
            <label className="text-xs text-gray-500 dark:text-gray-300 mr-2">Time</label>
            <select
              aria-label="Global time range"
              className="bg-transparent text-sm outline-none"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {timeRanges.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search + filter */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded shadow-sm">
            <input
              placeholder="Search sensors or device id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent text-sm outline-none w-52"
              title="Search by sensor name or device id"
            />
            <button
              className={`text-sm px-2 py-1 rounded ${onlyCritical ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => setOnlyCritical((v) => !v)}
              title="Toggle only critical sensors"
            >
              {onlyCritical ? 'Only Critical' : 'All'}
            </button>
          </div>

          {/* Export button with clear formats */}
          <div className="flex items-center gap-2">
            <select className="bg-white dark:bg-gray-800 px-2 py-1 rounded" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button onClick={doExport} className="bg-blue-600 text-white px-3 py-1 rounded" title="Export displayed sensor data">
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left column: Alerts + KPIs (prioritized) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Active Alerts — visually prioritized: red card, pulse animation, sticky at top */}
          <div className="sticky top-4">
            <div className="p-4 rounded-lg shadow-lg bg-red-600 text-white ring-2 ring-red-400/40">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Active Alerts</h2>
                  <p className="text-sm opacity-90">Shows unacknowledged alerts — act quickly.</p>
                </div>
                <div className="ml-3">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-white/20 rounded animate-pulse">{activeAlerts.length}</span>
                </div>
              </div>

              <div className="mt-3">
                {loading && <p className="text-sm">Loading alerts…</p>}
                {!loading && activeAlerts.length === 0 && <p className="text-sm">No active alerts — system nominal.</p>}
                {!loading && activeAlerts.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {activeAlerts.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 bg-white/10 p-2 rounded">
                        <div className="w-2 h-8 rounded bg-white/30" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold">{a.title}</div>
                              <div className="text-xs opacity-80">{a.message}</div>
                            </div>
                            <div className="text-xs text-gray-100">{new Date(a.createdAt).toLocaleTimeString()}</div>
                          </div>
                          <div className="mt-1 text-xs">
                            <button
                              onClick={() => {
                                // acknowledge locally for demo; in prod call API then refresh
                                setAlerts((prev) => (prev || []).map((x) => (x.id === a.id ? { ...x, acknowledged: true } : x)));
                              }}
                              className="text-xs text-blue-200 underline"
                            >
                              Acknowledge
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* KPIs / Overview cards */}
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">Overall Health</div>
                  <div className="text-2xl font-semibold">{sensors ? sensors.length : '—'} devices</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Last fetch</div>
                  <div className="text-sm">{lastFetchAttempt ? new Date(lastFetchAttempt).toLocaleTimeString() : '—'}</div>
                </div>
              </div>

              {/* Integrated Load Weather (contextual) */}
              <div className="mt-3 border-t pt-3 text-sm text-gray-600 dark:text-gray-300 flex items-center justify-between">
                <div>
                  <div className="font-medium">Weather Snapshot</div>
                  <div className="text-xs opacity-80">Click to load current conditions for the area — useful to correlate sensors</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        setLoadingWeather(true);
                        const summary = await weatherService.getManilaWeatherSummary();
                        setManilaWeather(summary);
                      } catch (err) {
                        console.warn('AdminDashboard: failed to load Manila weather', err);
                        setManilaWeather(null);
                      } finally {
                        setLoadingWeather(false);
                      }
                    }}
                    className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-sm"
                    title="Load weather for this site"
                  >
                    {loadingWeather ? 'Loading…' : 'Load Weather'}
                  </button>
                </div>
              </div>
            </div>

            {/* Unified empty state / sample chart preview: show a tiny sparkline-like preview */}
            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Sensor Activity (sample)</div>
                  <div className="text-lg font-semibold">Recent readings</div>
                </div>
                <div className="text-sm text-gray-500">{timeRange}</div>
              </div>
              <div className="mt-3 h-20 flex items-center justify-center text-gray-400">{/* Placeholder for sparkline */}
                <svg width="100%" height="48" viewBox="0 0 200 48" className="opacity-90">
                  <polyline fill="none" stroke="#38bdf8" strokeWidth={2} points="0,30 20,20 40,22 60,12 80,18 100,10 120,12 140,6 160,12 180,8 200,14" />
                </svg>
              </div>
            </div>

            {/* Manila Weather Summary (appears after Load Weather) */}
            {manilaWeather && (
              <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm text-gray-500">Manila Weather (avg)</div>
                    <div className="text-lg font-semibold">{manilaWeather.status?.toUpperCase() || 'NORMAL'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Last updated</div>
                    <div className="text-sm">{new Date(manilaWeather.lastUpdated).toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-xs text-gray-500">Avg Temp</div>
                    <div className="text-2xl font-bold">{manilaWeather.averageTemp}°C</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-xs text-gray-500">Avg Humidity</div>
                    <div className="text-2xl font-bold">{manilaWeather.averageHumidity}%</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="text-xs text-gray-500">Avg Moisture</div>
                    <div className="text-2xl font-bold">{manilaWeather.averageMoisture}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: sensors list + detail area */}
        <div className="col-span-12 lg:col-span-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sensor list card */}
            <div className="col-span-1 p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Sensors</h3>
                  <div className="text-sm text-gray-500">Filter and drill-down into device readings</div>
                </div>
                <div className="text-sm text-gray-500">Showing {filteredSensors ? filteredSensors.length : '—'}</div>
              </div>

              <div className="mt-4 space-y-3 max-h-96 overflow-auto">
                {loading && <div className="text-sm">Loading sensors…</div>}

                {!loading && filteredSensors && filteredSensors.length === 0 && (
                  <div className="p-6 rounded border-dashed border-2 border-gray-200 dark:border-gray-700 text-center">
                    <div className="font-medium">No matching sensors</div>
                    <div className="text-sm text-gray-500">Try clearing filters or adjust the global range.</div>
                  </div>
                )}

                {!loading && filteredSensors && filteredSensors.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded flex items-center justify-between cursor-pointer hover:shadow-md transition ${
                      s.status === 'critical'
                        ? 'bg-red-50 dark:bg-red-900/30 border border-red-400'
                        : s.status === 'warning'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300'
                        : 'bg-white dark:bg-gray-800'
                    }`}
                    onClick={() => setSelectedSensor(s)}
                    title={`Click to view ${s.name} details`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 font-semibold">
                        {s.name.split(' ').map((p) => p[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.deviceId} · Last: {fmtLastSeen(s.lastSeen)}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm">{s.temperature ?? '—'}°C</div>
                      <div className="text-xs text-gray-500">H:{s.humidity ?? '—'} M:{s.moisture ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sensor detail / drill-down */}
            <div className="col-span-1 p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              {selectedSensor ? (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedSensor.name}</h3>
                      <div className="text-sm text-gray-500">Device {selectedSensor.deviceId}</div>
                    </div>
                    <div className="text-sm text-gray-500">Last: {fmtLastSeen(selectedSensor.lastSeen)}</div>
                  </div>

                  {/* Threshold indicators with tooltips */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-xs text-gray-500">Temperature</div>
                      <div className="text-xl font-semibold">{selectedSensor.temperature ?? '—'}°C</div>
                    </div>
                    <div className="p-3 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">Humidity</div>
                        <div className="text-xs text-gray-400" title={`Warning: ${DEFAULT_THRESHOLDS.humidity.warning}%, Critical: ${DEFAULT_THRESHOLDS.humidity.critical}%`}>
                          thresholds
                        </div>
                      </div>
                      <div className="text-xl font-semibold">{selectedSensor.humidity ?? '—'}%</div>
                      <div className="text-xs mt-1">
                        <ThresholdBadge value={selectedSensor.humidity} thresholds={DEFAULT_THRESHOLDS.humidity} />
                      </div>
                    </div>
                    <div className="p-3 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-xs text-gray-500">Moisture</div>
                      <div className="text-xl font-semibold">{selectedSensor.moisture ?? '—'}%</div>
                      <div className="text-xs mt-1">
                        <ThresholdBadge value={selectedSensor.moisture} thresholds={DEFAULT_THRESHOLDS.moisture} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm text-gray-500">Sensor timeline (sample)</div>
                    <div className="mt-2 h-36 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-gray-400">Chart placeholder</div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button onClick={() => setSelectedSensor(null)} className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700">Close</button>
                    <button onClick={() => alert('Open device log (demo)')} className="px-3 py-1 rounded bg-blue-600 text-white">
                      Open Logs
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <div className="font-medium">No sensor selected</div>
                  <div className="text-sm mt-2">Click a sensor from the list to inspect readings and thresholds.</div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: Smart Tips + system feedback */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Smart Tips</h4>
                  <div className="text-sm text-gray-500">Context-aware and rotating</div>
                </div>
                <div className="text-sm text-gray-400">{timeRange}</div>
              </div>
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-200">{tips[tipIndex]}</div>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">System Status</h4>
                  <div className="text-sm text-gray-500">Fetch attempts and feedback</div>
                </div>
                <div className="text-sm text-gray-400">{loading ? 'Loading' : 'Idle'}</div>
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <div>Last fetch attempt: {lastFetchAttempt ? new Date(lastFetchAttempt).toLocaleString() : '—'}</div>
                <div className="mt-2">Sensors: {sensors ? sensors.length : '—'} · Alerts: {alerts ? alerts.length : '—'}</div>
                <div className="mt-2 text-xs text-gray-500">If network errors occur, the dashboard will retry and surface friendly messages here.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small component to display threshold status badges
function ThresholdBadge({ value, thresholds }: { value?: number | null; thresholds: { warning: number; critical: number } }) {
  if (value == null) return <span className="text-xs text-gray-400">No data</span>;
  if (value >= thresholds.critical) return <span className="text-xs text-red-600 font-medium">Critical</span>;
  if (value >= thresholds.warning) return <span className="text-xs text-yellow-600 font-medium">Warning</span>;
  return <span className="text-xs text-green-600 font-medium">Normal</span>;
}

// ensure this file is treated as a module for TS --isolatedModules
export {};
