import React from 'react';

type Alert = { id: string; title: string; severity: 'info'|'warning'|'critical'; message?: string };

const AlertsPanel: React.FC<{ alerts: Alert[]; onAcknowledge: (id:string)=>void; onDismiss: (id:string)=>void }> = ({ alerts, onAcknowledge, onDismiss }) => {
  return (
    <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Active Alerts</h3>
      <div className="space-y-3">
        {alerts.length === 0 && <div className="text-sm text-gray-500">No active alerts</div>}
        {alerts.map(a => (
          <div key={a.id} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 flex items-start justify-between">
            <div>
              <div className="text-sm font-medium">{a.title}</div>
              {a.message && <div className="text-xs text-gray-600 dark:text-gray-300">{a.message}</div>}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => onAcknowledge(a.id)} className="px-3 py-1 rounded bg-amber-500 text-white text-xs">Acknowledge</button>
              <button onClick={() => onDismiss(a.id)} className="px-3 py-1 rounded bg-gray-200 text-xs">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsPanel;
