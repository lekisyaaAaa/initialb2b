import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, Legend, CartesianGrid } from 'recharts';
import { exportCsv } from '../utils/export';

const SensorCharts: React.FC<{ data: Array<any>; keys: string[]; labels?: Record<string,string> }> = ({ data, keys, labels }) => {
  const [visible, setVisible] = useState<Record<string,boolean>>(() => keys.reduce((s,k)=>({ ...s, [k]: true }), {} as any));

  const exportData = () => {
    exportCsv(data, 'sensor-history.csv');
  };

  return (
    <div className="p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sensor History</h3>
        <div className="flex items-center gap-2">
          <button onClick={exportData} className="px-3 py-1 bg-primary-600 text-white rounded">Export CSV</button>
        </div>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <ReTooltip />
            <Legend onClick={(e:any) => setVisible(prev => ({ ...prev, [e.dataKey]: !prev[e.dataKey] }))} />
            {keys.map(k => (
              visible[k] ? <Line key={k} type="monotone" dataKey={k} stroke={`hsl(${(k.length*47)%360} 70% 45%)`} dot={false} /> : null
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SensorCharts;
