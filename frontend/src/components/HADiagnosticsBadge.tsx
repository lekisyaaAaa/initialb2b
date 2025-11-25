import React from 'react';
import { useData } from '../contexts/DataContext';

const HADiagnosticsBadge: React.FC = () => {
  const { latestHaSnapshot } = useData() as any;
  if (!latestHaSnapshot) {
    return (
      <div className="p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-600 dark:text-gray-300">
        HA: no snapshot
      </div>
    );
  }

  return (
    <div className="p-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 text-xs text-gray-700 dark:text-gray-200">
      <div className="font-semibold text-xs mb-1">Home Assistant Snapshot</div>
      <div className="flex gap-3">
        <div className="text-sm">Temp: {latestHaSnapshot.temperature ?? '—'}</div>
        <div className="text-sm">Moisture: {latestHaSnapshot.moisture ?? '—'}</div>
        <div className="text-sm">Water: {latestHaSnapshot.waterLevel ?? '—'}</div>
      </div>
      <div className="text-xs text-gray-500 mt-1">{latestHaSnapshot.timestamp ?? 'No timestamp'}</div>
    </div>
  );
};

export default HADiagnosticsBadge;
