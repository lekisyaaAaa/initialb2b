import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SensorData } from '../../types';

interface EcChartProps {
  data: SensorData[];
  height?: number | string;
  className?: string;
}

const EcChart: React.FC<EcChartProps> = ({ data, height = 400, className = '' }) => {
  // Filter out data points without EC values
  const ecData = data.filter(item => item.ec !== undefined && item.ec !== null);

  // Format data for the chart
  const chartData = ecData.map(item => ({
    timestamp: new Date(item.timestamp).getTime(),
    time: new Date(item.timestamp).toLocaleTimeString(),
    ec: item.ec,
    deviceId: item.deviceId
  }));

  // Calculate thresholds for reference lines
  const ecWarningThreshold = 2.0; // Default warning threshold
  const ecCriticalThreshold = 3.0; // Default critical threshold

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {`Time: ${data.time}`}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {`EC: ${data.ec} mS/cm`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {`Device: ${data.deviceId}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
            className="text-xs"
          />
          <YAxis
            domain={['dataMin - 0.1', 'dataMax + 0.1']}
            label={{ value: 'EC (mS/cm)', angle: -90, position: 'insideLeft' }}
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={ecWarningThreshold}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{ value: "Warning", position: "top", className: "text-xs" }}
          />
          <ReferenceLine
            y={ecCriticalThreshold}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{ value: "Critical", position: "top", className: "text-xs" }}
          />
          <Line
            type="monotone"
            dataKey="ec"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EcChart;
