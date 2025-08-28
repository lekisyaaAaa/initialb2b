import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { SensorData } from '../../types';

interface TemperatureChartProps {
  data: SensorData[];
  warningThreshold?: number;
  criticalThreshold?: number;
  height?: number;
}

const TemperatureChart: React.FC<TemperatureChartProps> = ({ 
  data, 
  warningThreshold = 35, 
  criticalThreshold = 40,
  height = 300
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-coffee-200 dark:border-gray-700">
          <p className="text-coffee-900 dark:text-white font-medium">{formatTooltipTime(label)}</p>
          <p className="text-coffee-700 dark:text-gray-300">
            <span className="font-medium">Temperature:</span> {data.temperature.toFixed(1)}°C
          </p>
          <p className="text-coffee-600 dark:text-gray-400 text-sm">Device: {data.deviceId}</p>
          <div className="flex items-center mt-2">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              data.temperature >= criticalThreshold ? 'bg-red-500' :
              data.temperature >= warningThreshold ? 'bg-yellow-500' : 'bg-green-500'
            }`}></div>
            <span className="text-sm text-coffee-600 dark:text-gray-300">
              {data.temperature >= criticalThreshold ? 'Critical' :
               data.temperature >= warningThreshold ? 'Warning' : 'Normal'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1c794" opacity={0.3} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime}
            stroke="#8b6f47"
            fontSize={12}
          />
          <YAxis 
            stroke="#8b6f47"
            fontSize={12}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Warning threshold line */}
          <ReferenceLine 
            y={warningThreshold} 
            stroke="#f59e0b" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ value: `Warning (${warningThreshold}°C)`, position: "right" }}
          />
          
          {/* Critical threshold line */}
          <ReferenceLine 
            y={criticalThreshold} 
            stroke="#ef4444" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            label={{ value: `Critical (${criticalThreshold}°C)`, position: "right" }}
          />
          
          <Line 
            type="monotone" 
            dataKey="temperature" 
            stroke="#a67c52" 
            strokeWidth={3}
            dot={{ fill: '#a67c52', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#8b6f47' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TemperatureChart;
