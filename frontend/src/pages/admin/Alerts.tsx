import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { alertService } from '../../services/api';
import { socket as sharedSocket } from '../../socket';
import type { Alert } from '../../types';

const severityLabel = (sev?: string) => (sev || '').toString().toLowerCase();

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<{ critical: number; warning: number; info: number }>({ critical: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, summaryRes] = await Promise.all([
        alertService.getActiveAlerts({ limit: 200 }).catch(() => null),
        alertService.getSummary().catch(() => null),
      ]);

      const activeList = Array.isArray(activeRes?.data?.data) ? (activeRes!.data!.data as Alert[]) : [];
      const s = (summaryRes?.data?.data || { critical: 0, warning: 0, info: 0 }) as { critical: number; warning: number; info: number };

      setAlerts(activeList);
      setSummary({
        critical: Number(s.critical || 0),
        warning: Number(s.warning || 0),
        info: Number(s.info || 0),
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAll = useCallback(async () => {
    setActionMessage(null);
    try {
      try {
        await alertService.clearAll();
      } catch (e) {
        await alertService.resolveAll();
      }
      setActionMessage('All alerts cleared');
      await loadAlerts();
    } catch (e) {
      setError('Failed to clear alerts');
    }
  }, [loadAlerts]);

  useEffect(() => {
    loadAlerts();
    const interval = window.setInterval(loadAlerts, 10000);

    const socket = sharedSocket;
    const onTrigger = () => loadAlerts();
    socket.on('alert:trigger', onTrigger);

    return () => {
      clearInterval(interval);
      socket.off('alert:trigger', onTrigger);
    };
  }, [loadAlerts]);

  const grouped = useMemo(() => {
    const map: Record<'critical' | 'warning' | 'info', Alert[]> = { critical: [], warning: [], info: [] };
    for (const a of alerts) {
      const sev = severityLabel(a.severity);
      if (sev === 'critical') {
        map.critical.push(a);
      } else if (sev === 'high' || sev === 'medium' || sev === 'warning') {
        map.warning.push(a);
      } else {
        map.info.push(a);
      }
    }
    return map;
  }, [alerts]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Active Alerts</h2>
        {loading && <span className="text-xs text-gray-400">Loading…</span>}
      </div>

      {error && <div className="rounded bg-red-900/60 px-3 py-2 text-sm text-red-100">{error}</div>}
      {actionMessage && <div className="rounded bg-emerald-900/60 px-3 py-2 text-sm text-emerald-100">{actionMessage}</div>}

      <div className="flex gap-4 text-sm">
        <div className="bg-red-900 px-3 py-1 rounded">Critical: {summary.critical}</div>
        <div className="bg-yellow-900 px-3 py-1 rounded">Warning: {summary.warning}</div>
        <div className="bg-blue-900 px-3 py-1 rounded">Info: {summary.info}</div>
      </div>

      <div className="flex gap-2">
        <button onClick={loadAlerts} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white">
          Refresh
        </button>
        <button onClick={clearAll} className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-white">
          Clear All
        </button>
      </div>

      {alerts.length === 0 ? (
        <p className="text-gray-400 mt-4">No active alerts.</p>
      ) : (
        (Object.entries(grouped) as Array<[string, Alert[]]>).map(([key, items]) =>
          items.length > 0 ? (
            <div key={key}>
              <h3 className="mt-4 text-lg font-medium capitalize text-white">{key}</h3>
              <ul className="space-y-2 mt-2">
                {items.map((a: Alert) => {
                  const ts = (a.createdAt || (a as any).timestamp || (a as any).updatedAt) as any;
                  const date = ts ? new Date(ts).toLocaleString() : '';
                  return (
                    <li
                      key={(a as any)._id || (a as any).id || `${a.deviceId}-${String(a.message)}-${String(ts)}`}
                      className={
                        'p-3 rounded ' +
                        (key === 'critical' ? 'bg-red-900' : key === 'warning' ? 'bg-yellow-900' : 'bg-blue-900')
                      }
                    >
                      <p className="text-white">{a.message || a.type || 'Alert'}</p>
                      <span className="text-xs text-gray-300">{date}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null
        )
      )}
    </div>
  );
}
