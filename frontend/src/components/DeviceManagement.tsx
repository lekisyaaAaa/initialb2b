import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Settings, RefreshCw, Plus, Trash2, AlertTriangle } from 'lucide-react';

type DeviceStatus = 'online' | 'offline';

interface ManagedDevice {
  id: string;
  deviceId: string;
  name?: string;
  status: DeviceStatus;
  lastSeen: string | null;
  firmwareVersion?: string;
  ipAddress?: string;
  sensors: string[];
  metadata?: Record<string, any> | null;
}

interface DeviceManagementProps {
  onDeviceSelect?: (device: ManagedDevice) => void;
}

type BackendDevice = {
  id?: number | string;
  deviceId?: string;
  status?: DeviceStatus | string;
  lastHeartbeat?: string;
  metadata?: Record<string, any> | null;
  name?: string;
};

const extractSensors = (metadata: Record<string, any> | null | undefined): string[] => {
  if (!metadata || typeof metadata !== 'object') return [];
  if (Array.isArray(metadata.sensors)) {
    return metadata.sensors.map((sensor: any) => String(sensor)).filter(Boolean);
  }
  if (metadata.sensors && typeof metadata.sensors === 'object') {
    return Object.keys(metadata.sensors).filter(Boolean);
  }
  if (Array.isArray(metadata.capabilities)) {
    return metadata.capabilities.map((sensor: any) => String(sensor)).filter(Boolean);
  }
  return [];
};

const generateFallbackId = () => {
  const globalCrypto = typeof globalThis !== 'undefined'
    ? (globalThis.crypto as { randomUUID?: () => string } | undefined)
    : undefined;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `device-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeDevice = (device: BackendDevice): ManagedDevice => {
  const rawMetadata = (device.metadata && typeof device.metadata === 'object') ? device.metadata : {};
  const metadata = rawMetadata as Record<string, any>;
  const sensors = extractSensors(metadata);
  const rawLastSeen = device.lastHeartbeat || metadata?.lastHeartbeat || metadata?.lastSeen || null;
  const statusValue = (device.status ?? metadata?.status ?? 'offline');
  const status = String(statusValue).toLowerCase() === 'online' ? 'online' : 'offline';

  let lastSeen: string | null = null;
  if (rawLastSeen instanceof Date) {
    lastSeen = rawLastSeen.toISOString();
  } else if (typeof rawLastSeen === 'number') {
    lastSeen = new Date(rawLastSeen).toISOString();
  } else if (rawLastSeen) {
    lastSeen = String(rawLastSeen);
  }

  return {
    id: String(device.id ?? device.deviceId ?? generateFallbackId()),
    deviceId: String(device.deviceId ?? device.id ?? generateFallbackId()),
    name: metadata?.name || metadata?.label || device.name,
    status,
    lastSeen,
    firmwareVersion: metadata?.firmwareVersion || metadata?.firmware || metadata?.version,
    ipAddress: metadata?.ipAddress || metadata?.ip || metadata?.ipv4,
    sensors,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
};

const formatLastSeen = (iso?: string | null): string => {
  if (!iso) return 'No recent heartbeat';
  try {
    return new Date(iso).toLocaleString();
  } catch (error) {
    return String(iso);
  }
};

export const DeviceManagement: React.FC<DeviceManagementProps> = ({ onDeviceSelect }) => {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const selectedDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  const loadDevices = useCallback(async (options?: { initial?: boolean }) => {
    const useSpinner = options?.initial ?? false;
    if (useSpinner) setLoading(true); else setRefreshing(true);
    try {
      setError(null);
      const response = await fetch('/api/devices', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const body = await response.json().catch(() => ({}));
      const rawList: BackendDevice[] = Array.isArray(body?.data)
        ? (body.data as BackendDevice[])
        : Array.isArray(body)
        ? (body as BackendDevice[])
        : [];
      const normalized = rawList.map((item) => normalizeDevice(item));
      normalized.sort((a: ManagedDevice, b: ManagedDevice) => {
        const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return bTime - aTime;
      });
      setDevices(normalized);
      const currentSelected = selectedDeviceIdRef.current;
      if (normalized.length === 0) {
        setSelectedDeviceId(null);
  } else if (currentSelected && normalized.some((device: ManagedDevice) => device.id === currentSelected)) {
        setSelectedDeviceId(currentSelected);
      } else {
        setSelectedDeviceId(normalized[0].id);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
      setDevices([]);
      setSelectedDeviceId(null);
      setError('Unable to load devices. Please verify the backend connection.');
    } finally {
      if (useSpinner) setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices({ initial: true });
    const interval = setInterval(() => loadDevices(), 15000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  const handleDeviceSelect = (device: ManagedDevice) => {
    setSelectedDeviceId(device.id);
    onDeviceSelect?.(device);
  };

  const handleCalibrate = (deviceId: string) => {
    window.alert(`Calibration can be triggered directly from the device firmware. Device ${deviceId} will continue sending live readings.`);
  };

  const handleRemoveDevice = (deviceId: string) => {
    window.alert(`Device ${deviceId} stays registered while the hardware is active. To archive it, disable the device firmware or remove it via backend tools.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading devices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Device Management</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Live view of registered sensor hubs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadDevices()}
            className="px-3 py-2 text-sm rounded-md border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            title="Refresh devices"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddDevice(true)}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {devices.map((device) => {
          const isSelected = selectedDeviceId === device.id;
          return (
            <div
              key={device.id}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => handleDeviceSelect(device)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${device.status === 'online' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                    {device.status === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">
                        {device.name || device.deviceId}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        device.status === 'online' ? 'text-green-600 bg-green-600/10' : 'text-red-600 bg-red-600/10'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      ID: {device.deviceId} • Last seen: {formatLastSeen(device.lastSeen)}
                    </div>
                    {device.ipAddress && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">IP: {device.ipAddress}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Firmware: {device.firmwareVersion || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {device.sensors.length} sensors
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCalibrate(device.deviceId);
                      }}
                      className="px-2 py-1 text-xs rounded border bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                      title="Calibration guidance"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveDevice(device.deviceId);
                      }}
                      className="px-2 py-1 text-xs rounded border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Removal guidance"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Sensors:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {device.sensors.length > 0 ? (
                          device.sensors.map((sensor) => (
                            <span key={sensor} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                              {sensor}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">No sensors reported</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Status:</span>
                      <div className="text-gray-800 dark:text-gray-200">
                        {device.status === 'online' ? 'Connected and reporting' : 'Offline'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Telemetry:</span>
                      <div className="text-gray-800 dark:text-gray-200">
                        {device.metadata?.reportingInterval
                          ? `${device.metadata.reportingInterval} seconds`
                          : 'Default interval'}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
                      <div className="text-gray-800 dark:text-gray-200">
                        {device.metadata ? (
                          <code className="text-xs break-all">{JSON.stringify(device.metadata)}</code>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No devices found</p>
          <p className="text-sm">Register a device or power on an existing unit to see it here.</p>
        </div>
      )}

      {showAddDevice && (
        <AddDeviceModal
          onClose={() => setShowAddDevice(false)}
          onAdded={async () => {
            await loadDevices({ initial: true });
          }}
        />
      )}
    </div>
  );
};

interface AddDeviceModalProps {
  onClose: () => void;
  onAdded: () => Promise<void> | void;
}

const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ onClose, onAdded }) => {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/devices/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceId.trim(),
          timestamp: new Date().toISOString(),
          metadata: {
            label: name.trim() || undefined,
            registeredVia: 'admin-dashboard'
          }
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || `Request failed with status ${response.status}`);
      }

      await onAdded();
      setSubmitting(false);
      setDeviceId('');
      setName('');
      onClose();
      return;
    } catch (err) {
      console.error('Failed to register device:', err);
      setError(err instanceof Error ? err.message : 'Unable to register device.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-70 bg-white dark:bg-gray-900 rounded-xl shadow-lg border p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Add Device
        </h3>

        {error && (
          <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Device ID *
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="esp32-001"
              className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Device Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Greenhouse Main"
              className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Registering…' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};