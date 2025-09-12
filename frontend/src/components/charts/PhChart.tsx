import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { SensorData } from '../../types';

interface PhChartProps {
  data: SensorData[];
  warningThreshold?: number; // acidic/alkaline warning threshold representation (e.g., <5 or >8)
  criticalThreshold?: number;
  height?: number | string;
  className?: string;
}

const PhChart: React.FC<PhChartProps> = ({ 
  data, 
  warningThreshold = 5, // loose example thresholds (pH scale)
  criticalThreshold = 4, 
  height = '100%',
  className
}) => {
  const formatTime = (timestamp: string) => {
    try { return format(new Date(timestamp), 'HH:mm'); } catch { return timestamp; }
  };

  const formatTooltipTime = (timestamp: string) => {
    try { return format(new Date(timestamp), 'MMM dd, HH:mm:ss'); } catch { return timestamp; }
  };

  const isDark = typeof window !== 'undefined' && (document.documentElement.classList.contains('dark') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-coffee-200">
          <p className="text-coffee-900 font-medium">{formatTooltipTime(label)}</p>
          <p className="text-coffee-700"><span className="font-medium">pH:</span> {typeof d.ph === 'number' ? d.ph.toFixed(2) : '—'}</p>
          <p className="text-coffee-600 text-sm">Device: {d.deviceId}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#e6f6fb'} opacity={0.3} />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} />
          <YAxis stroke={isDark ? '#9ca3af' : '#6b7280'} fontSize={12} domain={[0, 14]} />
          <Tooltip content={<CustomTooltip />} />

          {/* Warning / critical reference lines (illustrative) */}
          <ReferenceLine y={warningThreshold} stroke="#f59e0b" strokeDasharray="4 6" label={{ value: `Warning (${warningThreshold})`, position: 'right' }} />
          <ReferenceLine y={criticalThreshold} stroke="#ef4444" strokeDasharray="4 6" label={{ value: `Critical (${criticalThreshold})`, position: 'right' }} />

          <Line type="monotone" dataKey="ph" stroke={isDark ? '#60a5fa' : '#1e40af'} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PhChart;
