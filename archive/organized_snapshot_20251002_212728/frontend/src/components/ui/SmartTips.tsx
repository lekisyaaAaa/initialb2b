import React from 'react';

const tips = [
  { id: 't1', title: 'Optimize Placement', body: 'Place sensors in shaded areas to avoid heat bias.' },
  { id: 't2', title: 'Battery Health', body: 'Schedule battery checks every 3 months.' },
  { id: 't3', title: 'Moisture Balance', body: 'Avoid placing sensors near water sources to reduce false positives.' }
];

const SmartTips: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border">
      <h3 className="text-sm font-semibold text-espresso-900 mb-3">Smart Tips</h3>
      <ul className="space-y-2 text-sm text-gray-600">
        {tips.map(t => (
          <li key={t.id} className="p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-gray-500">{t.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SmartTips;
