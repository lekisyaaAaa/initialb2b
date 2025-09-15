import React from 'react';

type HealthItem = { label: string; ok: boolean; details?: string };

const HealthRow: React.FC<{ item: HealthItem }> = ({ item }) => (
  <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${item.ok ? 'bg-green-500' : 'bg-red-600'}`} />
      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.label}</div>
    </div>
    <div className="text-xs text-gray-500">{item.details}</div>
  </div>
);

const SystemHealth: React.FC<{ items: HealthItem[] }> = ({ items }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">System Health</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => (
          <HealthRow key={it.label} item={it} />
        ))}
      </div>
    </div>
  );
};

export default SystemHealth;
