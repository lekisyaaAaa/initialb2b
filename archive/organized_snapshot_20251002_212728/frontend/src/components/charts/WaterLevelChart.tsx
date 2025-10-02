import React from 'react';
import { toDateTime } from '../../utils/date';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SensorData } from '../../types';

interface WaterLevelChartProps {
  data: SensorData[];
  height?: number | string;
  className?: string;
}

const WaterLevelChart: React.FC<WaterLevelChartProps> = ({ data, height = 400, className = '' }) => {
  // Filter out data points without water level values
  const waterLevelData = data.filter(item => item.waterLevel !== undefined && item.waterLevel !== null);

  // Format data for the chart
  const chartData = waterLevelData.map(item => ({
    timestamp: toDateTime(item.timestamp).getTime(),
    time: toDateTime(item.timestamp).toLocaleTimeString(),
    waterLevel: item.waterLevel,
    deviceId: item.deviceId
  }));

  // Water level is binary: 0 = no water (critical), 1 = water present (normal)
  const criticalThreshold = 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {`Time: ${data.time}`}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {`Water Level: ${data.waterLevel === 1 ? 'Present' : 'Low/Critical'}`}
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
            domain={[0, 1]}
            ticks={[0, 1]}
            tickFormatter={(value) => value === 1 ? 'Present' : 'Low'}
            label={{ value: 'Water Level', angle: -90, position: 'insideLeft' }}
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={criticalThreshold}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{ value: "Critical", position: "top", className: "text-xs" }}
          />
          <Line
            type="stepAfter"
            dataKey="waterLevel"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WaterLevelChart;
