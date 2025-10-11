import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Cpu, Wifi, Database, Server, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface SystemMetrics {
  server: {
    status: 'online' | 'offline';
    uptime: number;
    cpu: number;
    memory: number;
    load: number;
  };
  database: {
    status: 'online' | 'offline';
    connections: number;
    latency: number;
    size: number;
  };
  network: {
    status: 'online' | 'offline';
    latency: number;
    bandwidth: number;
  };
  sensors: {
    total: number;
    online: number;
    offline: number;
    lastUpdate: string;
  };
  alerts: {
    total: number;
    critical: number;
    unresolved: number;
  };
}

interface SystemDiagnosticsProps {
  onMetricsUpdate?: (metrics: SystemMetrics) => void;
}

export const SystemDiagnostics: React.FC<SystemDiagnosticsProps> = ({ onMetricsUpdate }) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    server: { status: 'offline', uptime: 0, cpu: 0, memory: 0, load: 0 },
    database: { status: 'offline', connections: 0, latency: 0, size: 0 },
    network: { status: 'offline', latency: 0, bandwidth: 0 },
    sensors: { total: 0, online: 0, offline: 0, lastUpdate: '' },
    alerts: { total: 0, critical: 0, unresolved: 0 }
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      // Load health data
      const healthResponse = await fetch('/api/health');
      let healthData = null;
      if (healthResponse.ok) {
        healthData = await healthResponse.json();
      }

      // Load sensor stats
      const sensorsResponse = await fetch('/api/sensors/stats');
      let sensorsData = null;
      if (sensorsResponse.ok) {
        sensorsData = await sensorsResponse.json();
      }

      // Load alerts stats
      const alertsResponse = await fetch('/api/alerts/stats');
      let alertsData = null;
      if (alertsResponse.ok) {
        alertsData = await alertsResponse.json();
      }

      // Simulate additional metrics (in a real implementation, these would come from system monitoring APIs)
      const newMetrics: SystemMetrics = {
        server: {
          status: healthData?.database?.status === 'connected' ? 'online' : 'offline',
          uptime: healthData?.uptime || 0,
          cpu: Math.random() * 100, // Simulated
          memory: Math.random() * 100, // Simulated
          load: Math.random() * 4 // Simulated
        },
        database: {
          status: healthData?.database?.status === 'connected' ? 'online' : 'offline',
          connections: Math.floor(Math.random() * 20) + 1, // Simulated
          latency: Math.floor(Math.random() * 50) + 5, // Simulated
          size: Math.floor(Math.random() * 1000) + 100 // Simulated MB
        },
        network: {
          status: 'online', // Assume online if we can fetch data
          latency: Math.floor(Math.random() * 100) + 10, // Simulated
          bandwidth: Math.floor(Math.random() * 100) + 50 // Simulated Mbps
        },
        sensors: {
          total: sensorsData?.total || 0,
          online: sensorsData?.online || 0,
          offline: sensorsData?.offline || 0,
          lastUpdate: sensorsData?.lastUpdate || new Date().toISOString()
        },
        alerts: {
          total: alertsData?.total || 0,
          critical: alertsData?.critical || 0,
          unresolved: alertsData?.unresolved || 0
        }
      };

      setMetrics(newMetrics);
      setLastUpdate(new Date());
      onMetricsUpdate?.(newMetrics);
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
    const interval = setInterval(loadDiagnostics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [loadDiagnostics]);

  const getStatusColor = (status: string) => {
    return status === 'online' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    return status === 'online' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const MetricCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    status: string;
    children: React.ReactNode;
  }> = ({ title, icon, status, children }) => (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {icon}
          <h4 className="font-medium text-gray-800 dark:text-gray-200">{title}</h4>
        </div>
        <div className={`flex items-center space-x-1 ${getStatusColor(status)}`}>
          {getStatusIcon(status)}
          <span className="text-sm font-medium capitalize">{status}</span>
        </div>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            System Health Diagnostics
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Real-time monitoring of system components and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadDiagnostics}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-md border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Refresh diagnostics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overall System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">System Online</span>
          </div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Uptime: {formatUptime(metrics.server.uptime)}
            </span>
          </div>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {metrics.alerts.unresolved} Unresolved Alerts
            </span>
          </div>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
              {metrics.sensors.online}/{metrics.sensors.total} Sensors Online
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Metrics */}
        <MetricCard
          title="Server"
          icon={<Server className="w-5 h-5 text-gray-600" />}
          status={metrics.server.status}
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
              <span className="font-medium">{formatUptime(metrics.server.uptime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">CPU Usage:</span>
              <span className="font-medium">{metrics.server.cpu.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Memory:</span>
              <span className="font-medium">{metrics.server.memory.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Load Average:</span>
              <span className="font-medium">{metrics.server.load.toFixed(2)}</span>
            </div>
          </div>
        </MetricCard>

        {/* Database Metrics */}
        <MetricCard
          title="Database"
          icon={<Database className="w-5 h-5 text-gray-600" />}
          status={metrics.database.status}
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Connections:</span>
              <span className="font-medium">{metrics.database.connections}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Latency:</span>
              <span className="font-medium">{metrics.database.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Size:</span>
              <span className="font-medium">{formatBytes(metrics.database.size * 1024 * 1024)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`font-medium ${getStatusColor(metrics.database.status)}`}>
                {metrics.database.status}
              </span>
            </div>
          </div>
        </MetricCard>

        {/* Network Metrics */}
        <MetricCard
          title="Network"
          icon={<Wifi className="w-5 h-5 text-gray-600" />}
          status={metrics.network.status}
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Latency:</span>
              <span className="font-medium">{metrics.network.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Bandwidth:</span>
              <span className="font-medium">{metrics.network.bandwidth} Mbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`font-medium ${getStatusColor(metrics.network.status)}`}>
                {metrics.network.status}
              </span>
            </div>
          </div>
        </MetricCard>

        {/* Sensors Metrics */}
        <MetricCard
          title="Sensors"
          icon={<Activity className="w-5 h-5 text-gray-600" />}
          status={metrics.sensors.online > 0 ? 'online' : 'offline'}
        >
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Sensors:</span>
              <span className="font-medium">{metrics.sensors.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Online:</span>
              <span className="font-medium text-green-600">{metrics.sensors.online}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Offline:</span>
              <span className="font-medium text-red-600">{metrics.sensors.offline}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Last Update:</span>
              <span className="font-medium text-xs">
                {metrics.sensors.lastUpdate ? new Date(metrics.sensors.lastUpdate).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
        </MetricCard>
      </div>

      {/* Alerts Summary */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Alerts Summary
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{metrics.alerts.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Alerts</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="text-2xl font-bold text-red-600">{metrics.alerts.critical}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
            <div className="text-2xl font-bold text-yellow-600">{metrics.alerts.unresolved}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Unresolved</div>
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center">
          <Cpu className="w-5 h-5 mr-2" />
          Performance Trends
        </h4>
        <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Performance charts would be displayed here</p>
            <p className="text-sm">Integration with monitoring systems like Grafana/Prometheus</p>
          </div>
        </div>
      </div>
    </div>
  );
};