/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Bell, Check, Settings, Activity, Users, BarChart3, Calendar, RefreshCw } from 'lucide-react';
import SensorCharts from '../components/SensorCharts';
import SystemHealth from '../components/SystemHealth';
import DarkModeToggle from '../components/DarkModeToggle';
import HeaderFrame from '../components/layout/HeaderFrame';
import SensorSummaryPanel from '../components/SensorSummaryPanel';
import { DeviceManagement } from '../components/DeviceManagement';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import weatherService from '../services/weatherService';
import api, { alertService, sensorService } from '../services/api';
import { LatestSnapshot, SensorData as SensorDataType } from '../types';
import { socket as sharedSocket } from '../socket';
import RealtimeTelemetryPanel from '../components/RealtimeTelemetryPanel';

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
  signalStrength?: number | null;
  lastSeen?: string | null;
  deviceOnline?: boolean;
  deviceStatus?: string | null;
  timestamp?: string | null;
};

type Alert = { id: string; _id?: string; type?: string; title: string; severity: 'info' | 'warning' | 'critical'; message?: string; createdAt: string; acknowledged?: boolean };
type DeviceSummary = {
  deviceId: string;
  status: string;
  lastHeartbeat?: string | null;
  signalStrength?: number | null;
  metadata?: Record<string, any> | null;
};

type StatusPillProps = { label: string; status: string };

const SENSOR_STALE_THRESHOLD_MS = 60_000;

const mapSensorDataToSensor = (reading: Partial<SensorDataType> | null | undefined, fallbackId = 'vermilinks-homeassistant'): Sensor | null => {
  if (!reading) {
    return null;
  }
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const timestamp = reading.timestamp ? new Date(reading.timestamp).toISOString() : null;
  const npkValues = {
    n: toNumber(reading.nitrogen) ?? undefined,
    p: toNumber(reading.phosphorus) ?? undefined,
    k: toNumber(reading.potassium) ?? undefined,
  };
  const hasNpk = npkValues.n !== undefined || npkValues.p !== undefined || npkValues.k !== undefined;

  return {
    id: (reading.deviceId || fallbackId || 'home-assistant').toString(),
    name: 'Home Assistant Feed',
    deviceId: (reading.deviceId || fallbackId || 'home-assistant').toString(),
    temperature: toNumber(reading.temperature),
    humidity: toNumber(reading.humidity),
    moisture: toNumber(reading.moisture),
    ph: toNumber(reading.ph),
    ec: toNumber(reading.ec),
    npk: hasNpk ? npkValues : null,
    waterLevel: toNumber(reading.waterLevel ?? reading.floatSensor),
    batteryLevel: toNumber(reading.batteryLevel),
    lastSeen: timestamp,
    deviceOnline: reading.deviceOnline ?? true,
    deviceStatus: reading.deviceStatus ?? 'online',
    timestamp,
  };
};

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
  const {
    latestTelemetry: ctxTelemetry,
    latestSensorData: ctxSensorBuffer,
    isConnected: socketsConnected,
    refreshTelemetry: refreshLiveTelemetry,
  } = useData();
  const [latestSensor, setLatestSensor] = useState<Sensor | null>(null);
  const [sensorHistory, setSensorHistory] = useState<Sensor[]>([]);
  const cardClass = 'p-4 rounded-xl bg-white dark:bg-gray-900/80 border border-gray-100 dark:border-gray-800 shadow';
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [weatherSummary, setWeatherSummary] = useState<any | null>(null);
  const [systemStatus, setSystemStatus] = useState<{ server: string; database: string; apiLatency: number }>({ server: 'offline', database: 'offline', apiLatency: 0 });
  const [devicesOnline, setDevicesOnline] = useState<number>(0);
  const [deviceInventory, setDeviceInventory] = useState<DeviceSummary[]>([]);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Maintenance reminders state (populated from backend)
  const [reminders, setReminders] = useState<Array<any>>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<string>('Checking...');
  const [latestAlerts, setLatestAlerts] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertsSummary, setAlertsSummary] = useState<{ critical: number; warning: number; info: number }>({ critical: 0, warning: 0, info: 0 });
  const [alertsRefreshing, setAlertsRefreshing] = useState(false);
  const [alertsClearing, setAlertsClearing] = useState(false);
  const [alertsActionMessage, setAlertsActionMessage] = useState<string | null>(null);
  const [alertsActionError, setAlertsActionError] = useState<string | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const [realtimeRefreshing, setRealtimeRefreshing] = useState(false);

  const classifySeverity = useCallback((value: unknown): 'critical' | 'warning' | 'info' => {
    const normalized = (value || '').toString().toLowerCase();
    if (['critical', 'severe', 'fatal'].includes(normalized)) return 'critical';
    if (['warning', 'warn', 'high', 'medium', 'alert'].includes(normalized)) return 'warning';
    return 'info';
  }, []);

  const formatAlertTimestamp = useCallback((value: unknown) => {
    if (!value) return 'Unknown';
    try {
      const date = new Date(value as any);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleString();
    } catch (error) {
      return String(value);
    }
  }, []);

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

  const normalizeDeviceEntry = React.useCallback((device: any): DeviceSummary => {
    const idSource = device?.deviceId ?? device?.device_id ?? device?.id ?? device?.name ?? device?.identifier ?? 'unknown-device';
    const deviceId = idSource != null ? idSource.toString() : 'unknown-device';

    const statusSource = device?.status ?? device?.deviceStatus ?? (typeof device?.online === 'boolean' ? (device.online ? 'online' : 'offline') : null);
    const rawStatus = statusSource != null ? statusSource.toString().toLowerCase() : 'offline';
    let normalizedStatus = rawStatus;
    if (rawStatus === 'true') normalizedStatus = 'online';
    if (rawStatus === 'false') normalizedStatus = 'offline';
    if (['connected', 'ready', 'available', 'up'].includes(rawStatus)) normalizedStatus = 'online';
    if (['disconnected', 'down'].includes(rawStatus)) normalizedStatus = 'offline';
    if (!normalizedStatus || normalizedStatus === 'unknown') normalizedStatus = 'offline';

    const heartbeatSource = device?.lastHeartbeat ?? device?.last_heartbeat ?? device?.last_seen ?? device?.lastSeen ?? device?.timestamp ?? device?.updatedAt ?? device?.createdAt ?? null;
    const signalStrength = typeof device?.signalStrength === 'number'
      ? device.signalStrength
      : (typeof device?.rssi === 'number' ? device.rssi : null);
    const metadata = device?.metadata && typeof device.metadata === 'object'
      ? device.metadata
      : (device?.info && typeof device.info === 'object' ? device.info : null);

    return {
      deviceId,
      status: normalizedStatus,
      lastHeartbeat: heartbeatSource ?? null,
      signalStrength: signalStrength ?? null,
      metadata: metadata ?? null,
    };
  }, []);

  const updateDeviceStats = React.useCallback((list: DeviceSummary[]) => {
    const onlineCount = list.filter((device) => {
      const status = (device.status || '').toString().toLowerCase();
      return ['online', 'connected', 'ready', 'available', 'up'].includes(status);
    }).length;
    setDevicesOnline(onlineCount);
    setSensorStatus(onlineCount > 0 ? `${onlineCount} device${onlineCount === 1 ? '' : 's'} online` : 'No sensors connected');
  }, []);

  const applyDeviceStatusUpdate = React.useCallback((payload: any) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    const normalized = normalizeDeviceEntry(payload);
    if (!normalized.deviceId) {
      return;
    }

    setDeviceInventory((prev) => {
      let found = false;
      const next = prev.map((entry) => {
        if (entry.deviceId === normalized.deviceId) {
          found = true;
          return {
            ...entry,
            status: normalized.status || entry.status,
            lastHeartbeat: normalized.lastHeartbeat ?? entry.lastHeartbeat ?? null,
            signalStrength: normalized.signalStrength ?? entry.signalStrength ?? null,
            metadata: normalized.metadata ?? entry.metadata ?? null,
          };
        }
        return entry;
      });

      if (!found) {
        next.push(normalized);
      }

      updateDeviceStats(next);
      setDeviceError(null);
      return next;
    });
  }, [normalizeDeviceEntry, updateDeviceStats]);

  const refreshDeviceInventory = React.useCallback(async () => {
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const body = await res.json().catch(() => ({}));
      const rawList = Array.isArray(body?.data) ? body.data : (Array.isArray(body) ? body : []);
      const uniqueDevices = new Map<string, DeviceSummary>();
      (rawList || []).forEach((device: any) => {
        const entry = normalizeDeviceEntry(device);
        uniqueDevices.set(entry.deviceId, entry);
      });

      const normalized = Array.from(uniqueDevices.values());
      setDeviceInventory(normalized);
      updateDeviceStats(normalized);
      setDeviceError(null);
    } catch (e: any) {
      console.warn('AdminDashboard::refreshDeviceInventory', e?.message || e);
      setDeviceInventory([]);
      updateDeviceStats([]);
      setDeviceError('Unable to load device inventory');
    }
  }, [normalizeDeviceEntry, updateDeviceStats]);

  const formatHeartbeat = React.useCallback((value?: string | null) => {
    if (!value) return 'No heartbeat recorded';
    try {
      return new Date(value).toLocaleString();
    } catch (e) {
      return String(value);
    }
  }, []);

  useEffect(() => {
    if (!sharedSocket) {
      return undefined;
    }

    const handleDeviceStatus = (payload: any) => {
      try {
        applyDeviceStatusUpdate(payload);
      } catch (error) {
        console.warn('AdminDashboard::device-status handler error', error);
      }
    };

    sharedSocket.on('device:status', handleDeviceStatus);
    sharedSocket.on('device_status', handleDeviceStatus);
    sharedSocket.on('deviceHeartbeat', handleDeviceStatus);
    sharedSocket.on('device_heartbeat', handleDeviceStatus);

    return () => {
      sharedSocket.off('device:status', handleDeviceStatus);
      sharedSocket.off('device_status', handleDeviceStatus);
      sharedSocket.off('deviceHeartbeat', handleDeviceStatus);
      sharedSocket.off('device_heartbeat', handleDeviceStatus);
    };
  }, [applyDeviceStatusUpdate]);

  const loadLatestAlerts = useCallback(async (options?: { showLoader?: boolean }) => {
    const showLoader = Boolean(options?.showLoader);
    if (showLoader) {
      setAlertsRefreshing(true);
      setAlertsActionMessage(null);
      setAlertsActionError(null);
    }

    try {
      const response = await alertService.getRecentAlerts(50);
      if (response?.data?.success) {
        const alerts = Array.isArray(response.data.data) ? response.data.data : [];
        setLatestAlerts(alerts);
        setUnreadCount(alerts.filter((alert: any) => (alert.status || alert.state || '').toString() === 'new').length);
        const summary = alerts.reduce(
          (acc: { critical: number; warning: number; info: number }, alert: any) => {
            const bucket = classifySeverity(alert.severity ?? alert.level ?? alert.type);
            acc[bucket] += 1;
            return acc;
          },
          { critical: 0, warning: 0, info: 0 },
        );
        setAlertsSummary(summary);
      } else {
        setLatestAlerts([]);
        setUnreadCount(0);
        setAlertsSummary({ critical: 0, warning: 0, info: 0 });
      }
    } catch (error) {
      console.error('Failed to load recent alerts:', error);
      setLatestAlerts([]);
      setUnreadCount(0);
      setAlertsSummary({ critical: 0, warning: 0, info: 0 });
      if (showLoader) {
        setAlertsActionError('Failed to load alerts. Try again in a moment.');
      }
    } finally {
      if (showLoader) {
        setAlertsRefreshing(false);
      }
    }
  }, [classifySeverity]);

  const markAlertAsRead = useCallback(async (alertId?: string) => {
    if (!alertId) {
      return;
    }
    setAcknowledgingAlertId(alertId);
    try {
      await alertService.markAsRead(alertId);
      setAlertsActionError(null);
      setAlertsActionMessage('Alert acknowledged.');
      await loadLatestAlerts();
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
      setAlertsActionError('Failed to acknowledge alert.');
    } finally {
      setAcknowledgingAlertId(null);
    }
  }, [loadLatestAlerts]);

  const handleRealtimeRefresh = useCallback(async () => {
    if (!refreshLiveTelemetry) {
      return;
    }
    setRealtimeRefreshing(true);
    try {
      await refreshLiveTelemetry({ background: false });
    } catch (error) {
      // Ignore errors; fallback polling will retry
    } finally {
      setRealtimeRefreshing(false);
    }
  }, [refreshLiveTelemetry]);

  const handleRefreshActiveAlerts = useCallback(() => {
    loadLatestAlerts({ showLoader: true });
  }, [loadLatestAlerts]);

  const handleClearAllAlerts = useCallback(async () => {
    if (alertsClearing) {
      return;
    }
    setAlertsClearing(true);
    setAlertsActionMessage(null);
    setAlertsActionError(null);
    try {
      try {
        await alertService.clearAll();
      } catch (primaryError) {
        await alertService.resolveAll();
      }
      setAlertsActionMessage('All alerts cleared.');
      await loadLatestAlerts();
    } catch (error) {
      console.error('Failed to clear alerts:', error);
      setAlertsActionError('Failed to clear alerts.');
    } finally {
      setAlertsClearing(false);
    }
  }, [alertsClearing, loadLatestAlerts]);

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
        let latestSnapshot: LatestSnapshot | null = null;
        try {
          latestSnapshot = await sensorService.getLatestData();
        } catch (err) {
          console.warn('AdminDashboard::loadLatest sensor fetch error', err);
          throw err;
        }

        let healthResp = null;
        try {
          healthResp = await api.get('/health');
        } catch (err: any) {
          console.warn('AdminDashboard::loadLatest health fetch error', err?.message || err);
          healthResp = null;
        }

        if (!mounted) return;

        const latency = Date.now() - start;
        const snapshot = latestSnapshot ?? null;
        const resolvedDeviceId = snapshot ? 'vermilinks-homeassistant' : null;

        const candidateReading: Sensor | null = snapshot && resolvedDeviceId
          ? {
              id: resolvedDeviceId,
              name: 'VermiLinks Sensor Suite',
              deviceId: resolvedDeviceId,
              temperature: snapshot.temperature,
              humidity: snapshot.humidity,
              moisture: snapshot.soil_moisture,
              waterLevel: snapshot.float_state,
              lastSeen: snapshot.updated_at,
              deviceOnline: true,
              deviceStatus: 'online',
            }
          : null;

        if (candidateReading) {
          setLatestSensor(candidateReading);
          setSensorHistory((prev) => {
            const next = [...prev.slice(-199), candidateReading as Sensor];
            return next;
          });
        } else {
          setLatestSensor(null);
          setSensorHistory([]);
        }

        const healthPayload: any = healthResp?.data || {};

        const primaryServerStatus =
          healthPayload?.status ??
          (healthResp ? 'online' : 'offline');

        const primaryDatabaseStatus =
          healthPayload?.database?.status ??
          (healthResp ? 'online' : 'offline');

        const toStatusString = (value: unknown, fallback: string) => {
          if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim().toLowerCase();
          }
          if (typeof value === 'boolean') {
            return value ? 'online' : 'offline';
          }
          return fallback;
        };

        const healthyValue = (value: string) => (
          ['online', 'connected', 'ok', 'ready', 'healthy', 'up', 'available', 'reachable'].includes(value)
            ? 'online'
            : value
        );

        const normalizedServerStatus = healthyValue(toStatusString(primaryServerStatus, 'online'));
        const normalizedDatabaseStatus = healthyValue(toStatusString(primaryDatabaseStatus, 'online'));

        setSystemStatus({
          server: normalizedServerStatus,
          database: normalizedDatabaseStatus,
          apiLatency: latency,
        });
      } catch (error) {
        console.warn('AdminDashboard::loadLatest error', error);
        if (!mounted) return;
        setSystemStatus({ server: 'offline', database: 'offline', apiLatency: 0 });
        setLatestSensor(null);
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
    refreshDeviceInventory();
    // also fetch initial history for charts
    (async function loadHistory() {
      try {
        const response = await api.get('/ha/history', { params: { limit: 336 } }).catch(() => null);
        if (!response || !response.data || !response.data.success) {
          setSensorHistory([]);
          return;
        }
        const readings = Array.isArray(response.data?.data?.readings)
          ? response.data.data.readings
          : [];
        if (!readings.length) {
          setSensorHistory([]);
          return;
        }
        const normalized = (readings as SensorDataType[])
          .map((entry) => mapSensorDataToSensor(entry))
          .filter((entry): entry is Sensor => Boolean(entry));
        const ordered = normalized.sort((a: Sensor, b: Sensor) => {
          const aTime = new Date(a.timestamp || a.lastSeen || 0).getTime();
          const bTime = new Date(b.timestamp || b.lastSeen || 0).getTime();
          return aTime - bTime;
        });
        setSensorHistory(ordered.slice(-336));
      } catch (e) {
        setSensorHistory([]);
      }
    })();
  const idDevices = setInterval(refreshDeviceInventory, 10000);
    const id1 = setInterval(loadLatest, 5000);
    const id2 = setInterval(loadAlerts, 15000);
    const id3 = setInterval(loadHealth, 10000);
    const id4 = setInterval(loadReminders, 60_000);
    const id5 = setInterval(loadLatestAlerts, 10000); // Poll for new alerts every 10 seconds
    return () => { mounted = false; clearInterval(idDevices); clearInterval(id1); clearInterval(id2); clearInterval(id3); clearInterval(id4); clearInterval(id5); };
  }, [refreshDeviceInventory, loadLatestAlerts]);

  useEffect(() => {
    if (devicesOnline > 0) {
      setSensorStatus(`${devicesOnline} device${devicesOnline === 1 ? '' : 's'} online`);
    } else if (latestSensor) {
      setSensorStatus('Sensor activity detected');
    } else {
      setSensorStatus('No sensors connected');
    }
  }, [devicesOnline, latestSensor]);

  useEffect(() => {
    if (!ctxTelemetry) {
      return;
    }
    const mapped = mapSensorDataToSensor(ctxTelemetry);
    if (!mapped) {
      return;
    }
    setLatestSensor(mapped);
    setSensorHistory((prev) => {
      const merged = [...prev, mapped];
      return merged.slice(-336);
    });
  }, [ctxTelemetry]);

  useEffect(() => {
    if (devicesOnline === 0) {
      setLatestSensor(null);
      setSensorHistory([]);
    }
  }, [devicesOnline]);

  useEffect(() => {
    if (!alertsActionMessage) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setAlertsActionMessage(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [alertsActionMessage]);

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

  const realtimeSample = useMemo<SensorDataType | null>(() => {
    if (ctxTelemetry) {
      return ctxTelemetry;
    }
    if (!latestSensor) {
      return null;
    }
    return {
      deviceId: latestSensor.deviceId,
      temperature: latestSensor.temperature ?? undefined,
      humidity: latestSensor.humidity ?? undefined,
      moisture: latestSensor.moisture ?? undefined,
      ph: latestSensor.ph ?? undefined,
      ec: latestSensor.ec ?? undefined,
      nitrogen: latestSensor.npk?.n ?? undefined,
      phosphorus: latestSensor.npk?.p ?? undefined,
      potassium: latestSensor.npk?.k ?? undefined,
      waterLevel: latestSensor.waterLevel ?? undefined,
      floatSensor: latestSensor.waterLevel ?? undefined,
      batteryLevel: latestSensor.batteryLevel ?? undefined,
      signalStrength: latestSensor.signalStrength ?? undefined,
      timestamp: latestSensor.timestamp || latestSensor.lastSeen || undefined,
    } as SensorDataType;
  }, [ctxTelemetry, latestSensor]);

  const telemetryHistory = useMemo<SensorDataType[]>(() => {
    if (Array.isArray(ctxSensorBuffer) && ctxSensorBuffer.length > 0) {
      return ctxSensorBuffer;
    }
    if (!sensorHistory.length) {
      return [];
    }
    return sensorHistory.map((entry) => ({
      deviceId: entry.deviceId,
      temperature: entry.temperature ?? undefined,
      humidity: entry.humidity ?? undefined,
      moisture: entry.moisture ?? undefined,
      ph: entry.ph ?? undefined,
      ec: entry.ec ?? undefined,
      nitrogen: entry.npk?.n ?? undefined,
      phosphorus: entry.npk?.p ?? undefined,
      potassium: entry.npk?.k ?? undefined,
      waterLevel: entry.waterLevel ?? undefined,
      batteryLevel: entry.batteryLevel ?? undefined,
      signalStrength: entry.signalStrength ?? undefined,
      timestamp: entry.timestamp || entry.lastSeen || undefined,
    }));
  }, [ctxSensorBuffer, sensorHistory]);

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

  const hasConnectedSensors = useMemo(() => {
    if (deviceInventory.some((device) => (device.status || '').toLowerCase() === 'online')) {
      return true;
    }
    if (latestSensor) {
      return true;
    }
    return sensorHistory.some((entry) => {
      if (entry.deviceOnline) return true;
      const status = (entry.deviceStatus || '').toString().toLowerCase();
      return status === 'online';
    });
  }, [deviceInventory, latestSensor, sensorHistory]);

  const reportsAvailable = useMemo(() => {
    if (!hasConnectedSensors) {
      return false;
    }
    return sensorHistory.length > 0 || filteredAlerts.length > 0 || latestAlerts.length > 0;
  }, [filteredAlerts, hasConnectedSensors, latestAlerts, sensorHistory]);

  const groupedActiveAlerts = useMemo(() => {
    const buckets: Record<'critical' | 'warning' | 'info', any[]> = {
      critical: [],
      warning: [],
      info: [],
    };
    latestAlerts.forEach((alert) => {
      const bucket = classifySeverity(alert?.severity ?? alert?.level ?? alert?.type);
      buckets[bucket].push(alert);
    });
    return buckets;
  }, [classifySeverity, latestAlerts]);

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
        badgeLabel="Admin Dashboard"
        badgeTone="emerald"
        contextTag={(
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            System Online
          </div>
        )}
        rightSlot={(
          <div className="flex w-full items-center justify-end gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <span className="font-medium">Latency:</span>
              <span>{systemStatus.apiLatency}ms</span>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Realtime control active
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="rounded-lg border border-coffee-200 bg-white px-3 py-2 text-sm font-medium text-coffee-700 transition-colors hover:border-coffee-300 hover:text-coffee-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              Logout
            </button>
            <DarkModeToggle />
          </div>
        )}
      />,
      document.body
    );
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'monitoring' | 'management' | 'reports'>('overview');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = (params.get('tab') || '').toLowerCase();
    if (['overview', 'devices', 'monitoring', 'management', 'reports'].includes(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab as typeof activeTab);
    }
  }, [activeTab, location.search]);

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

  const chartData = devicesOnline > 0 ? sensorHistory.map((s, i) => ({ time: `${i * 5}s`, temperature: s.temperature ?? 0, humidity: s.humidity ?? 0, moisture: s.moisture ?? 0, ph: s.ph ?? 0, ec: s.ec ?? 0, waterLevel: s.waterLevel ?? 0 })) : [];

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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-300">
            Monitor realtime telemetry, sensor trends, and live alerts below. Hardware status updates every few seconds.
          </div>
          <div className="inline-flex items-center justify-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Backend online
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Database connected
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${devicesOnline > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              ESP32 {devicesOnline > 0 ? 'active' : 'awaiting heartbeat'}
            </div>
          </div>
        </div>

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
              {/* Alerts tab intentionally removed — alerts are managed inside Monitoring */}
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

                <RealtimeTelemetryPanel
                  latest={realtimeSample}
                  history={telemetryHistory}
                  isConnected={Boolean(socketsConnected || realtimeSample)}
                  onRefresh={handleRealtimeRefresh}
                  refreshing={realtimeRefreshing}
                />
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
                  <p className="text-gray-600 dark:text-gray-400">Configure thresholds and manage alerts</p>
                </div>

                <div className="bg-white dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 rounded-xl shadow p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Device Inventory</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tracking registered field devices and their latest heartbeat status.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 text-xs font-medium rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {devicesOnline} online / {deviceInventory.length} detected
                      </span>
                      <button
                        type="button"
                        onClick={refreshDeviceInventory}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <RefreshCw className="w-4 h-4" /> Refresh
                      </button>
                    </div>
                  </div>
                  {deviceError && (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      {deviceError}
                    </div>
                  )}
                  {deviceInventory.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                      No devices are registered yet. The monitoring widgets will activate automatically once a device reports in.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {deviceInventory.map((device) => (
                        <div key={device.deviceId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white/70 dark:bg-gray-900/50">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                Device {device.deviceId}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Last heartbeat: {formatHeartbeat(device.lastHeartbeat)}
                              </p>
                            </div>
                            <StatusPill label="Status" status={device.status} />
                          </div>
                          <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                            {device.signalStrength !== null && device.signalStrength !== undefined && (
                              <div>Signal strength: {device.signalStrength} dBm</div>
                            )}
                            {device.metadata && Object.keys(device.metadata).length > 0 && (
                              <div>
                                Metadata: {Object.entries(device.metadata).filter(([key]) => key !== '_id').map(([key, value]) => `${key}: ${value}`).join(', ')}
                              </div>
                            )}
                            {device.status !== 'online' && (
                              <div className="text-amber-600 dark:text-amber-300">
                                Awaiting reconnect. Commands remain disabled until the device is back online.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <SensorSummaryPanel className="mt-6" />

                <div className="bg-white dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 rounded-xl shadow p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Active Alerts</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Latest unresolved alerts requiring attention.</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <div className="flex gap-2 text-xs font-semibold">
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">Critical: {alertsSummary.critical}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Warning: {alertsSummary.warning}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">Info: {alertsSummary.info}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleRefreshActiveAlerts}
                          disabled={alertsRefreshing || alertsClearing}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${alertsRefreshing || alertsClearing ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                        >
                          {alertsRefreshing ? 'Refreshing…' : 'Refresh'}
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAllAlerts}
                          disabled={alertsClearing || latestAlerts.length === 0}
                          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${alertsClearing || latestAlerts.length === 0 ? 'cursor-not-allowed border border-rose-200 bg-rose-100 text-rose-500 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300' : 'border border-rose-200 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-700'}`}
                        >
                          {alertsClearing ? 'Clearing…' : 'Clear All'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {alertsActionError && (
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                      {alertsActionError}
                    </div>
                  )}
                  {alertsActionMessage && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                      {alertsActionMessage}
                    </div>
                  )}

                  <div className="mt-6">
                    {latestAlerts.length === 0 ? (
                      <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
                        No active alerts.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {(['critical', 'warning', 'info'] as const).map((bucket) => {
                          const items = groupedActiveAlerts[bucket];
                          if (!items || items.length === 0) {
                            return null;
                          }
                          const bucketLabel = bucket === 'critical' ? 'Critical' : bucket === 'warning' ? 'Warning' : 'Info';
                          const badgeTone = bucket === 'critical'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                            : bucket === 'warning'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200';
                          return (
                            <div key={bucket}>
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeTone}`}>
                                  {bucketLabel}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{items.length} active</span>
                              </div>
                              <ul className="mt-3 space-y-3">
                                {items.map((alert: any, index: number) => {
                                  const alertId = alert.id || alert._id || alert.uuid || alert.timestamp || `${bucket}-${index}`;
                                  const status = (alert.status || alert.state || '').toString().toLowerCase();
                                  const deviceLabel = alert.deviceId || alert.device || alert.sensorId;
                                  const isAcknowledged = ['read', 'acknowledged', 'resolved', 'cleared'].includes(status);
                                  return (
                                    <li key={alertId} className="rounded-lg border border-gray-200 bg-white/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/60">
                                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeTone}`}>
                                              {bucketLabel}
                                            </span>
                                            {status === 'new' && (
                                              <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                                            )}
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatAlertTimestamp(alert.createdAt || alert.timestamp || alert.updatedAt)}</span>
                                          </div>
                                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                            {alert.title || alert.message || 'Alert triggered'}
                                          </p>
                                          {alert.description && (
                                            <p className="text-xs text-gray-600 dark:text-gray-300">{alert.description}</p>
                                          )}
                                          {deviceLabel && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Device: {deviceLabel}</p>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 self-start md:self-center">
                                          {isAcknowledged ? (
                                            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                              Acknowledged
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => markAlertAsRead(alertId)}
                                              disabled={acknowledgingAlertId === alertId}
                                              className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium transition ${acknowledgingAlertId === alertId ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                            >
                                              {acknowledgingAlertId === alertId ? 'Acknowledging…' : 'Acknowledge'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
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

                {/* Management sensors panel */}
                <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg shadow">
                  <div className="p-4 max-h-96 overflow-y-auto space-y-4">
                    <div className="text-center py-8">
                      <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Sensor Configuration</h3>
                      <p className="text-gray-600 dark:text-gray-400">Advanced sensor settings and calibration</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">Sensor Status</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{sensorStatus}</p>
                        {devicesOnline === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Waiting for ESP32 devices to report a heartbeat.
                          </p>
                        )}
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-800 dark:text-gray-100">Connected Sensors</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Live device inventory reported by the backend.</p>
                          </div>
                          <button
                            onClick={refreshDeviceInventory}
                            className="px-3 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Refresh
                          </button>
                        </div>
                        {deviceError && (
                          <div className="text-xs text-rose-600 dark:text-rose-300 mb-2">{deviceError}</div>
                        )}
                        {deviceInventory.length === 0 ? (
                          <p className="text-sm text-gray-600 dark:text-gray-400">No sensors detected yet.</p>
                        ) : (
                          <ul className="space-y-2 max-h-56 overflow-auto pr-1">
                            {deviceInventory.map((device) => {
                              const online = device.status === 'online';
                              return (
                                <li key={device.deviceId} className="flex items-start justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2">
                                  <div className="text-sm text-gray-700 dark:text-gray-200">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{device.deviceId}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Last heartbeat: {formatHeartbeat(device.lastHeartbeat)}</div>
                                    {device.metadata?.name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">Label: {device.metadata.name}</div>
                                    )}
                                  </div>
                                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                                    online
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                                  }`}>
                                    {online ? 'Online' : 'Offline'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
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

                {!reportsAvailable ? (
                  <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-8 text-center text-sm text-gray-600 dark:text-gray-300">
                    <p className="font-medium text-gray-800 dark:text-gray-100">Reports are unavailable.</p>
                    <p className="mt-2">Connect a sensor or wait for live telemetry to generate analytics and alert summaries.</p>
                  </div>
                ) : (
                  <>
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
                          <button
                            title="Export as PDF"
                            onClick={() => window.print()}
                            className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white"
                          >
                            Export PDF
                          </button>
                          <button
                            title="Export as CSV"
                            onClick={async () => {
                              const rows = sensorHistory.map(s => ({
                                timestamp: (s as any).timestamp || new Date().toISOString(),
                                deviceId: s.deviceId || '',
                                temperature: s.temperature ?? '',
                                humidity: s.humidity ?? '',
                                moisture: s.moisture ?? '',
                                ph: s.ph ?? '',
                                ec: s.ec ?? '',
                                waterLevel: s.waterLevel ?? '',
                              }));
                              const csv = [
                                ['timestamp','deviceId','temperature','humidity','moisture','ph','ec','waterLevel'],
                                ...rows.map(r => [r.timestamp, r.deviceId, r.temperature, r.humidity, r.moisture, r.ph, r.ec, r.waterLevel])
                              ].map(r => r.join(',')).join('\n');
                              const blob = new Blob([csv], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'sensor-history.csv';
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            }}
                            className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-700"
                          >
                            Export CSV
                          </button>
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
                          <p className="text-sm text-gray-600">Overview of sensors currently reporting data.</p>
                          <p className="text-sm text-gray-500 mt-1">{sensorStatus}</p>
                          <div className="mt-3 space-y-2">
                            {deviceInventory.length === 0 ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400">No sensors connected.</p>
                            ) : (
                              deviceInventory.slice(0, 3).map((device) => (
                                <div key={device.deviceId} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1">
                                  <span className="font-medium text-gray-700 dark:text-gray-200">{device.deviceId}</span>
                                  <span className={device.status === 'online' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}>
                                    {device.status === 'online' ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                              ))
                            )}
                            {deviceInventory.length > 3 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">+{deviceInventory.length - 3} more sensor(s)</p>
                            )}
                          </div>
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
  {/* remove FAB for Gary-Sheng clean layout */}
    </div>
  );
}

