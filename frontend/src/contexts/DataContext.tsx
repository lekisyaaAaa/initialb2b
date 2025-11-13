import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, SensorData } from '../types';
import api, {
  alertService,
  deviceService,
  discoverApi,
  sensorService,
} from '../services/api';
import { getSocket } from '../socket';

interface DeviceStatusInfo {
  deviceId: string;
  online: boolean;
  status: string;
  lastHeartbeat: string | null;
  updatedAt: string | null;
}

interface AlertBuckets {
  critical: Alert[];
  warning: Alert[];
  info: Alert[];
}

interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  lastAlertAt: string | null;
}

interface FloatLockoutState {
  active: boolean;
  deviceId: string | null;
  message: string | null;
  floatSensor: number | null;
  updatedAt: string | null;
}

interface DataContextType {
  latestTelemetry: SensorData | null;
  latestSensorData: SensorData[];
  deviceStatuses: Record<string, DeviceStatusInfo>;
  recentAlerts: Alert[];
  groupedAlerts: AlertBuckets;
  alertSummary: AlertSummary;
  floatLockoutState: FloatLockoutState | null;
  isConnected: boolean;
  isLoading: boolean;
  lastFetchAt: string | null;
  lastFetchError: string | null;
  refreshTelemetry: () => Promise<void>;
  refreshSensors: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  clearAlerts: () => Promise<void>;
  clearLastFetchError: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

interface DataProviderProps {
  children: ReactNode;
}

const normalizeSeverityToBucket = (severity?: string | null): keyof AlertBuckets => {
  const value = (severity || '').toString().toLowerCase();
  if (value === 'critical') return 'critical';
  if (value === 'high' || value === 'warning' || value === 'medium') return 'warning';
  return 'info';
};

const bucketizeAlerts = (alerts: Alert[]): AlertBuckets => {
  const buckets: AlertBuckets = { critical: [], warning: [], info: [] };
  alerts.forEach((alert) => {
    const bucket = normalizeSeverityToBucket(alert?.severity || alert?.type);
    buckets[bucket].push(alert);
  });
  return buckets;
};

const computeSummaryFromBuckets = (buckets: AlertBuckets): AlertSummary => {
  const allAlerts = [...buckets.critical, ...buckets.warning, ...buckets.info];
  const lastAlertAt = allAlerts
    .map((alert) => alert?.createdAt || alert?.updatedAt || null)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .reduce<number | null>((acc, ts) => {
      if (!Number.isFinite(ts)) return acc;
      if (acc === null) return ts as number;
      return ts > acc ? ts : acc;
    }, null);

  return {
    critical: buckets.critical.length,
    warning: buckets.warning.length,
    info: buckets.info.length,
    lastAlertAt: lastAlertAt ? new Date(lastAlertAt).toISOString() : null,
  };
};

const backendBaseFromApi = () => {
  const current = api.defaults.baseURL || '';
  if (!current) return '';
  return current.replace(/\/?api$/i, '');
};

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [latestTelemetry, setLatestTelemetry] = useState<SensorData | null>(null);
  const [latestSensorData, setLatestSensorData] = useState<SensorData[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatusInfo>>({});
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [groupedAlerts, setGroupedAlerts] = useState<AlertBuckets>({ critical: [], warning: [], info: [] });
  const [alertSummary, setAlertSummary] = useState<AlertSummary>({ critical: 0, warning: 0, info: 0, lastAlertAt: null });
  const [floatLockoutState, setFloatLockoutState] = useState<FloatLockoutState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null);
  const [lastFetchError, setLastFetchError] = useState<string | null>(null);
  const backendBaseRef = useRef<string>('');

  const ensureBackendBase = useCallback(async () => {
    if (backendBaseRef.current) return backendBaseRef.current;
    const fromApi = backendBaseFromApi();
    if (fromApi) {
      backendBaseRef.current = fromApi;
      return backendBaseRef.current;
    }
    try {
      const discovery = await discoverApi({ timeout: 1500 });
      if (discovery.ok && discovery.baseURL) {
        const normalized = discovery.baseURL.replace(/\/?api$/i, '');
        backendBaseRef.current = normalized;
        return backendBaseRef.current;
      }
    } catch (e) {
      // discovery best-effort only
    }
    return '';
  }, []);

  const mergeDeviceStatus = useCallback((update: Partial<DeviceStatusInfo> & { deviceId: string }) => {
    let computed: Record<string, DeviceStatusInfo> = {};
    setDeviceStatuses((prev) => {
      const existing = prev[update.deviceId];
      const next: DeviceStatusInfo = {
        deviceId: update.deviceId,
        online: update.online ?? existing?.online ?? false,
        status: update.status || existing?.status || (update.online ? 'online' : 'offline'),
        lastHeartbeat: update.lastHeartbeat ?? existing?.lastHeartbeat ?? null,
        updatedAt: update.updatedAt ?? new Date().toISOString(),
      };
      computed = { ...prev, [update.deviceId]: next };
      return computed;
    });
    if (Object.keys(computed).length > 0) {
      const anyOnline = Object.values(computed).some((state) => state.online);
      setIsConnected(anyOnline);
    } else if (!latestTelemetry) {
      setIsConnected(false);
    }
  }, [latestTelemetry]);

  const refreshAlerts = useCallback(async () => {
    try {
      const [recentResponse, summaryResponse] = await Promise.all([
        alertService.getRecentAlerts(20).catch(() => ({ data: { data: [] } })),
        alertService.getSummary().catch(() => ({ critical: 0, warning: 0, info: 0, lastAlertAt: null })),
      ]);

      const recentPayload = (recentResponse?.data?.data ?? []) as Alert[];
      const sortedAlerts = [...recentPayload].sort((a, b) => {
        const aTs = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
        const bTs = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
        return bTs - aTs;
      });

      const buckets = bucketizeAlerts(sortedAlerts);
      let summary: AlertSummary;
      if ('critical' in summaryResponse && 'warning' in summaryResponse && 'info' in summaryResponse) {
        const summaryCandidate = summaryResponse as Partial<AlertSummary> & { critical?: number; warning?: number; info?: number };
        summary = {
          critical: Number(summaryCandidate.critical ?? 0),
          warning: Number(summaryCandidate.warning ?? 0),
          info: Number(summaryCandidate.info ?? 0),
          lastAlertAt: typeof summaryCandidate.lastAlertAt !== 'undefined'
            ? summaryCandidate.lastAlertAt ?? computeSummaryFromBuckets(buckets).lastAlertAt
            : computeSummaryFromBuckets(buckets).lastAlertAt,
        };
      } else {
        summary = computeSummaryFromBuckets(buckets);
      }

      setRecentAlerts(sortedAlerts);
      setGroupedAlerts(buckets);
      setAlertSummary(summary);
    } catch (error: any) {
      setRecentAlerts([]);
      setGroupedAlerts({ critical: [], warning: [], info: [] });
      setAlertSummary({ critical: 0, warning: 0, info: 0, lastAlertAt: null });
      setLastFetchError(error?.message || 'Unable to load alerts');
      throw error;
    }
  }, []);

  const clearAlerts = useCallback(async () => {
    try {
      await alertService.clearAll();
      await refreshAlerts();
    } catch (error: any) {
      setLastFetchError(error?.message || 'Unable to clear alerts');
      throw error;
    }
  }, [refreshAlerts]);

  const handleTelemetryPayload = useCallback((raw: any, options?: { updateLatestList?: boolean }) => {
    if (!raw) return;
    const sample = Array.isArray(raw) ? raw[0] : raw;
    if (!sample || typeof sample !== 'object') return;

    const deviceId = (sample as any).deviceId || (sample as any).device_id || 'unknown-device';
    const normalized: SensorData = {
      ...(sample as SensorData),
      deviceId,
    };

    setLatestTelemetry(normalized);
    if (options?.updateLatestList !== false) {
      setLatestSensorData((prev) => {
        const filtered = Array.isArray(prev)
          ? prev.filter((reading) => (reading?.deviceId || '') !== deviceId)
          : [];
        return [...filtered, normalized];
      });
    }
    setLastFetchAt(new Date().toISOString());
    setLastFetchError(null);

    const online = Boolean((sample as any)?.deviceOnline ?? ((sample as any)?.deviceStatus || '').toString().toLowerCase() === 'online');
    const heartbeat = (sample as any)?.timestamp || (sample as any)?.receivedAt || null;
    mergeDeviceStatus({
      deviceId,
      online,
      status: online ? 'online' : 'offline',
      lastHeartbeat: heartbeat ? new Date(heartbeat).toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
    return normalized;
  }, [mergeDeviceStatus]);

  const refreshTelemetry = useCallback(async () => {
    setIsLoading(true);
    setLastFetchError(null);
    try {
      await ensureBackendBase();
      const response = await sensorService.getLatestData();
      const root = response?.data;
      const payload = (root?.data ?? root ?? null) as SensorData | SensorData[] | null;
      const readings: SensorData[] = Array.isArray(payload)
        ? payload as SensorData[]
        : payload && typeof payload === 'object'
          ? [payload as SensorData]
          : [];

      if (readings.length > 0) {
        handleTelemetryPayload(readings[0], { updateLatestList: false });
        setLatestSensorData(readings);
      } else {
        setLatestTelemetry(null);
        setLatestSensorData([]);
        setIsConnected(false);
      }
    } catch (error: any) {
      setLastFetchError(error?.message || 'Unable to load telemetry');
      setLatestTelemetry(null);
      setLatestSensorData([]);
      setIsConnected(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [ensureBackendBase, handleTelemetryPayload]);

  const refreshSensors = useCallback(async () => {
    await refreshTelemetry();
  }, [refreshTelemetry]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await ensureBackendBase();
        await Promise.all([
          refreshTelemetry().catch(() => null),
          refreshAlerts().catch(() => null),
          (async () => {
            const resp = await deviceService.list().catch(() => null);
            const devices = (resp?.data?.data ?? resp?.data ?? []) as any[];
            devices.forEach((device) => {
              const deviceId = (device?.deviceId || device?.device_id || '').toString();
              if (!deviceId) return;
              if (!isMounted) return;
              mergeDeviceStatus({
                deviceId,
                online: Boolean(device?.status === 'online' || device?.online === true),
                status: (device?.status || (device?.online ? 'online' : 'offline')) || 'offline',
                lastHeartbeat: device?.lastHeartbeat ? new Date(device.lastHeartbeat).toISOString() : null,
                updatedAt: device?.updatedAt ? new Date(device.updatedAt).toISOString() : new Date().toISOString(),
              });
            });
          })(),
        ]);
      } catch (error: any) {
        setLastFetchError(error?.message || 'Initialization failed');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [ensureBackendBase, mergeDeviceStatus, refreshAlerts, refreshTelemetry]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const telemetryHandler = (payload: any) => handleTelemetryPayload(payload);

    const deviceStatusHandler = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      const deviceId = (payload.deviceId || payload.device_id || payload.id || '').toString();
      if (!deviceId) return;
      mergeDeviceStatus({
        deviceId,
        online: Boolean(payload.online ?? (payload.status || '').toString().toLowerCase() === 'online'),
        status: (payload.status || (payload.online ? 'online' : 'offline')) || 'offline',
        lastHeartbeat: payload.lastHeartbeat ? new Date(payload.lastHeartbeat).toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
    };

    const floatLockoutHandler = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      const action = (payload.action || payload.type || '').toString().toLowerCase();
      if (action === 'clear' || action === 'cleared') {
        setFloatLockoutState({
          active: false,
          deviceId: payload.deviceId ?? null,
          message: null,
          floatSensor: typeof payload.floatSensor === 'number' ? payload.floatSensor : null,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
      setFloatLockoutState({
        active: true,
        deviceId: payload.deviceId ?? null,
        message: payload.message || 'Float sensor lockout active',
        floatSensor: typeof payload.floatSensor === 'number' ? payload.floatSensor : null,
        updatedAt: new Date().toISOString(),
      });
    };

    const alertsTriggerHandler = () => {
      refreshAlerts().catch(() => null);
    };

    socket.on('telemetry:update', telemetryHandler);
    socket.on('sensor_update', telemetryHandler);
    socket.on('device:status', deviceStatusHandler);
    socket.on('device_status', deviceStatusHandler);
    socket.on('floatLockout', floatLockoutHandler);
    socket.on('floatLockoutCleared', floatLockoutHandler);
    socket.on('alert:trigger', alertsTriggerHandler);

    return () => {
      socket.off('telemetry:update', telemetryHandler);
      socket.off('sensor_update', telemetryHandler);
      socket.off('device:status', deviceStatusHandler);
      socket.off('device_status', deviceStatusHandler);
      socket.off('floatLockout', floatLockoutHandler);
      socket.off('floatLockoutCleared', floatLockoutHandler);
      socket.off('alert:trigger', alertsTriggerHandler);
    };
  }, [handleTelemetryPayload, mergeDeviceStatus, refreshAlerts]);

  const contextValue = useMemo<DataContextType>(() => ({
    latestTelemetry,
    latestSensorData,
    deviceStatuses,
    recentAlerts,
    groupedAlerts,
    alertSummary,
    floatLockoutState,
    isConnected,
    isLoading,
    lastFetchAt,
    lastFetchError,
    refreshTelemetry,
    refreshSensors,
    refreshAlerts,
    clearAlerts,
    clearLastFetchError: () => setLastFetchError(null),
  }), [
    latestTelemetry,
    latestSensorData,
    deviceStatuses,
    recentAlerts,
    groupedAlerts,
    alertSummary,
    floatLockoutState,
    isConnected,
    isLoading,
    lastFetchAt,
    lastFetchError,
    refreshTelemetry,
    refreshSensors,
    refreshAlerts,
    clearAlerts,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
