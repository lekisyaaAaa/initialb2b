import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DarkModeToggle from '../components/DarkModeToggle';
import DataSuppressedNotice from '../components/DataSuppressedNotice';
import { Download, Search } from 'lucide-react';
import { DATA_SUPPRESSED } from '../utils/dataSuppression';

type LogEntry = {
  id: string;
  type: 'sensor' | 'login' | 'alert';
  message: string;
  timestamp: string;
  details?: any;
};

const LogsPageContent = (): React.ReactElement => {
  const { user, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    loadLogs();
  }, [isAuthenticated, user]);

  useEffect(() => {
    let filtered = logs;
    if (search) {
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(search.toLowerCase())
      );
    }
    if (typeFilter !== 'all') {
      filtered = filtered.filter(log => log.type === typeFilter);
    }
    setFilteredLogs(filtered);
  }, [logs, search, typeFilter]);

  async function loadLogs() {
    try {
      const sensorRes = await fetch('/api/sensors?limit=100');
      const sensorData = sensorRes.ok ? await sensorRes.json() : [];

      const alertRes = await fetch('/api/alerts?limit=100');
      const alertData = alertRes.ok ? await alertRes.json() : [];

      const allLogs: LogEntry[] = [];

      sensorData.forEach((sensor: any) => {
        allLogs.push({
          id: `sensor-${sensor.id}`,
          type: 'sensor',
          message: `Sensor reading: ${sensor.deviceId}`,
          timestamp: sensor.lastSeen || sensor.timestamp,
          details: sensor,
        });
      });

      alertData.forEach((alert: any) => {
        allLogs.push({
          id: `alert-${alert.id}`,
          type: 'alert',
          message: alert.title,
          timestamp: alert.createdAt,
          details: alert,
        });
      });

      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(allLogs);
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setLoading(false);
    }
  }

  function exportLogs() {
    const csv = [
      ['Type', 'Message', 'Timestamp', 'Details'],
      ...filteredLogs.map(log => [
        log.type,
        log.message,
        log.timestamp,
        JSON.stringify(log.details),
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading logs...</div>;
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-4 z-30 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm shadow">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">System Logs</h1>
          <DarkModeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <div className="p-6 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Logs ({filteredLogs.length})</h2>
            <button
              onClick={exportLogs}
              className="flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white/80 dark:bg-gray-700/60 text-sm"
                />
              </div>
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-white/80 dark:bg-gray-700/60 text-sm"
            >
              <option value="all">All Types</option>
              <option value="sensor">Sensor</option>
              <option value="alert">Alert</option>
              <option value="login">Login</option>
            </select>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No logs found</div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          log.type === 'sensor' ? 'bg-blue-100 text-blue-800' :
                          log.type === 'alert' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.type}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800 dark:text-gray-200">{log.message}</div>
                      {log.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer">Details</summary>
                          <pre className="text-xs text-gray-600 mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const LogsPageSuppressed = (): React.ReactElement => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">System Logs</h1>
          <p className="text-sm text-gray-500">Export temporarily disabled</p>
        </div>
        <DarkModeToggle />
      </div>
    </header>
    <main className="mx-auto max-w-4xl px-6 py-10">
      <DataSuppressedNotice
        title="Logs unavailable"
        instructions="Audit and sensor logs cannot be viewed while telemetry is suppressed."
      />
    </main>
  </div>
);

const LogsPage = (): React.ReactElement => {
  if (DATA_SUPPRESSED) {
    return <LogsPageSuppressed />;
  }
  return <LogsPageContent />;
};

export default LogsPage;
