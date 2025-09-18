import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { SensorData } from '../../types';
import { toDateTime } from '../../utils/date';

interface NpkChartProps {
  data: SensorData[];
  height?: number | string;
  className?: string;
}

const NpkChart: React.FC<NpkChartProps> = ({ data, height = 400, className = '' }) => {
  // Filter out data points without NPK values
  const npkData = data.filter(item =>
    (item.nitrogen !== undefined && item.nitrogen !== null) ||
    (item.phosphorus !== undefined && item.phosphorus !== null) ||
    (item.potassium !== undefined && item.potassium !== null)
  );

  // Format data for the chart
  const chartData = npkData.map(item => ({
    timestamp: toDateTime(item.timestamp).getTime(),
    time: toDateTime(item.timestamp).toLocaleTimeString(),
    nitrogen: item.nitrogen,
    phosphorus: item.phosphorus,
    potassium: item.potassium,
    deviceId: item.deviceId
  }));

  // Calculate thresholds for reference lines
  const nitrogenWarningThreshold = 50; // Default warning threshold
  const nitrogenCriticalThreshold = 30; // Default critical threshold
  const phosphorusWarningThreshold = 20;
  const phosphorusCriticalThreshold = 10;
  const potassiumWarningThreshold = 100;
  const potassiumCriticalThreshold = 50;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {`Time: ${data.time}`}
          </p>
          {data.nitrogen !== undefined && (
            <p className="text-sm text-green-600 dark:text-green-400">
              {`Nitrogen: ${data.nitrogen} mg/kg`}
            </p>
          )}
          {data.phosphorus !== undefined && (
            <p className="text-sm text-orange-600 dark:text-orange-400">
              {`Phosphorus: ${data.phosphorus} mg/kg`}
            </p>
          )}
          {data.potassium !== undefined && (
            <p className="text-sm text-purple-600 dark:text-purple-400">
              {`Potassium: ${data.potassium} mg/kg`}
            </p>
          )}
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
            domain={['dataMin - 5', 'dataMax + 5']}
            label={{ value: 'NPK (mg/kg)', angle: -90, position: 'insideLeft' }}
            className="text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine
            y={nitrogenWarningThreshold}
            stroke="#10b981"
            strokeDasharray="2 2"
            label={{ value: "N Warning", position: "top", className: "text-xs" }}
          />
          <ReferenceLine
            y={nitrogenCriticalThreshold}
            stroke="#059669"
            strokeDasharray="5 5"
            label={{ value: "N Critical", position: "top", className: "text-xs" }}
          />
          <ReferenceLine
            y={phosphorusWarningThreshold}
            stroke="#f97316"
            strokeDasharray="2 2"
            label={{ value: "P Warning", position: "top", className: "text-xs" }}
          />
          <ReferenceLine
            y={phosphorusCriticalThreshold}
            stroke="#ea580c"
            strokeDasharray="5 5"
            label={{ value: "P Critical", position: "top", className: "text-xs" }}
          />
          <ReferenceLine
            y={potassiumWarningThreshold}
            stroke="#a855f7"
            strokeDasharray="2 2"
            label={{ value: "K Warning", position: "top", className: "text-xs" }}
          />
          <ReferenceLine
            y={potassiumCriticalThreshold}
            stroke="#9333ea"
            strokeDasharray="5 5"
            label={{ value: "K Critical", position: "top", className: "text-xs" }}
          />
          <Line
            type="monotone"
            dataKey="nitrogen"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            name="Nitrogen"
          />
          <Line
            type="monotone"
            dataKey="phosphorus"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            name="Phosphorus"
          />
          <Line
            type="monotone"
            dataKey="potassium"
            stroke="#a855f7"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            name="Potassium"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NpkChart;
