import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Settings, RefreshCw, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface ESP32Device {
  id: string;
  deviceId: string;
  name?: string;
  status: 'online' | 'offline';
  lastSeen: string;
  firmwareVersion?: string;
  ipAddress?: string;
  sensors: string[];
}

interface DeviceManagementProps {
  onDeviceSelect?: (device: ESP32Device) => void;
}

export const DeviceManagement: React.FC<DeviceManagementProps> = ({ onDeviceSelect }) => {
  const [devices, setDevices] = useState<ESP32Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<ESP32Device | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDevices = async () => {
    try {
      // In a real implementation, this would fetch from /api/sensors/devices or similar
      // For now, we'll simulate with mock data
      const mockDevices: ESP32Device[] = [
        {
          id: '1',
          deviceId: 'esp32-001',
          name: 'Greenhouse Main',
          status: 'online',
          lastSeen: new Date().toISOString(),
          firmwareVersion: '1.2.3',
          ipAddress: '192.168.1.100',
          sensors: ['temperature', 'humidity', 'moisture', 'ph', 'ec']
        },
        {
          id: '2',
          deviceId: 'esp32-002',
          name: 'Compost Area',
          status: 'online',
          lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
          firmwareVersion: '1.2.2',
          ipAddress: '192.168.1.101',
          sensors: ['temperature', 'humidity', 'moisture']
        },
        {
          id: '3',
          deviceId: 'esp32-003',
          name: 'Storage Room',
          status: 'offline',
          lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          firmwareVersion: '1.1.9',
          ipAddress: '192.168.1.102',
          sensors: ['temperature', 'humidity']
        }
      ];
      setDevices(mockDevices);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceSelect = (device: ESP32Device) => {
    setSelectedDevice(device);
    onDeviceSelect?.(device);
  };

  const handleCalibrate = async (deviceId: string) => {
    try {
      // In a real implementation, this would call /api/sensors/calibrate/:deviceId
      alert(`Calibration triggered for device ${deviceId}`);
    } catch (error) {
      console.error('Calibration failed:', error);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (window.confirm(`Are you sure you want to remove device ${deviceId}?`)) {
      try {
        // In a real implementation, this would call DELETE /api/sensors/devices/:deviceId
        setDevices(devices.filter(d => d.id !== deviceId));
      } catch (error) {
        console.error('Failed to remove device:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'online' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    return status === 'online' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;
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
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          ESP32 Device Management
        </h3>
        <div className="flex gap-2">
          <button
            onClick={loadDevices}
            className="px-3 py-2 text-sm rounded-md border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh devices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddDevice(true)}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Device
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedDevice?.id === device.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => handleDeviceSelect(device)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${device.status === 'online' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  {getStatusIcon(device.status)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-800 dark:text-gray-200">
                      {device.name || device.deviceId}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(device.status)} bg-current bg-opacity-10`}>
                      {device.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    ID: {device.deviceId} • Last seen: {new Date(device.lastSeen).toLocaleString()}
                  </div>
                  {device.ipAddress && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      IP: {device.ipAddress}
                    </div>
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
                      handleCalibrate(device.id);
                    }}
                    className="px-2 py-1 text-xs rounded border bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                    title="Calibrate device"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveDevice(device.id);
                    }}
                    className="px-2 py-1 text-xs rounded border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                    title="Remove device"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {selectedDevice?.id === device.id && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Sensors:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {device.sensors.map(sensor => (
                        <span key={sensor} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                          {sensor}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Uptime:</span>
                    <div className="text-gray-800 dark:text-gray-200">
                      {device.status === 'online' ? 'Connected' : 'Offline'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Data Rate:</span>
                    <div className="text-gray-800 dark:text-gray-200">
                      {device.status === 'online' ? '5 min' : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Alerts:</span>
                    <div className="text-gray-800 dark:text-gray-200">
                      {device.status === 'online' ? '0 active' : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No ESP32 devices found</p>
          <p className="text-sm">Add your first device to start monitoring</p>
        </div>
      )}

      {showAddDevice && (
        <AddDeviceModal
          onClose={() => setShowAddDevice(false)}
          onAdd={(device) => {
            setDevices([...devices, device]);
            setShowAddDevice(false);
          }}
        />
      )}
    </div>
  );
};

interface AddDeviceModalProps {
  onClose: () => void;
  onAdd: (device: ESP32Device) => void;
}

const AddDeviceModal: React.FC<AddDeviceModalProps> = ({ onClose, onAdd }) => {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) return;

    const newDevice: ESP32Device = {
      id: Date.now().toString(),
      deviceId: deviceId.trim(),
      name: name.trim() || undefined,
      status: 'offline',
      lastSeen: new Date().toISOString(),
      sensors: []
    };

    onAdd(newDevice);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-70 bg-white dark:bg-gray-900 rounded-xl shadow-lg border p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Add ESP32 Device
        </h3>

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
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Add Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};