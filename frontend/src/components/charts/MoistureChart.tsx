import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { SensorData } from '../../types';

interface MoistureChartProps {
  data: SensorData[];
  warningThreshold?: number;
  criticalThreshold?: number;
  height?: number | string;
  className?: string;
}

const MoistureChart: React.FC<MoistureChartProps> = ({ 
  data, 
  warningThreshold = 300, 
  criticalThreshold = 100,
  height = '100%',
  className
}) => {
  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return timestamp;
    }
  };

  const formatTooltipTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM dd, HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  const isDark = typeof window !== 'undefined' && (document.documentElement.classList.contains('dark') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-coffee-200">
          <p className="text-coffee-900 font-medium">{formatTooltipTime(label)}</p>
          <p className="text-coffee-700">
            <span className="font-medium">Moisture:</span> {data.moisture.toFixed(1)}%
          </p>
          <p className="text-coffee-600 text-sm">Device: {data.deviceId}</p>
          <div className="flex items-center mt-2">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              data.moisture <= criticalThreshold ? 'bg-red-500' :
              data.moisture <= warningThreshold ? 'bg-[#03A9F4]' : 'bg-green-500'
            }`}></div>
            <span className="text-sm text-coffee-600">
              {data.moisture <= criticalThreshold ? 'Critical' :
               data.moisture <= warningThreshold ? 'Warning' : 'Normal'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full ${className || ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#cfeef5'} opacity={0.3} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime}
            stroke={isDark ? '#9ca3af' : '#6b7280'}
            fontSize={12}
          />
          <YAxis 
            stroke={isDark ? '#9ca3af' : '#6b7280'}
            fontSize={12}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Warning threshold line */}
          <ReferenceLine 
            y={warningThreshold} 
            stroke="#03A9F4" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ value: `Warning (${warningThreshold}%)`, position: "right" }}
          />
          
          {/* Critical threshold line */}
          <ReferenceLine 
            y={criticalThreshold} 
            stroke="#ef4444" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ value: `Critical (${criticalThreshold}%)`, position: "right" }}
          />
          
          <Line 
            type="monotone" 
            dataKey="moisture" 
            stroke={isDark ? '#00BFA6' : '#10b981'} 
            strokeWidth={3}
            dot={{ fill: isDark ? '#00BFA6' : '#10b981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: isDark ? '#038f75' : '#047857' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MoistureChart;
