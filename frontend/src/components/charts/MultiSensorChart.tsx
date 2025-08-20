import React from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { SensorData } from '../../types';

interface MultiSensorChartProps {
  data: SensorData[];
  height?: number;
  showLegend?: boolean;
}

const MultiSensorChart: React.FC<MultiSensorChartProps> = ({ 
  data, 
  height = 400,
  showLegend = true
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
        <div className="bg-white p-4 rounded-lg shadow-lg border border-coffee-200">
          <p className="text-coffee-900 font-medium">{formatTooltipTime(label)}</p>
          <div className="space-y-1">
            <p className="text-coffee-700">
              <span className="font-medium">Temperature:</span> {data.temperature.toFixed(1)}°C
            </p>
            <p className="text-coffee-700">
              <span className="font-medium">Humidity:</span> {data.humidity.toFixed(1)}%
            </p>
            <p className="text-coffee-700">
              <span className="font-medium">Moisture:</span> {data.moisture.toFixed(1)}%
            </p>
            {data.batteryLevel && (
              <p className="text-coffee-700">
                <span className="font-medium">Battery:</span> {data.batteryLevel}%
              </p>
            )}
          </div>
          <p className="text-coffee-600 text-sm mt-2">Device: {data.deviceId}</p>
        </div>
      );
    }
    return null;
  };

  // Normalize data for better visualization (scale temperature for comparison)
  const normalizedData = data.map(item => ({
    ...item,
    scaledTemperature: item.temperature * 2.5, // Scale temperature to be visible alongside humidity/moisture
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={normalizedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e1c794" opacity={0.3} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatTime}
            stroke="#8b6f47"
            fontSize={12}
          />
          <YAxis 
            yAxisId="left"
            stroke="#8b6f47"
            fontSize={12}
            domain={[0, 100]}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#8b6f47"
            fontSize={12}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && (
            <Legend 
              iconType="line"
              wrapperStyle={{ paddingTop: '10px' }}
            />
          )}
          
          {/* Humidity as bars */}
          <Bar 
            yAxisId="left"
            dataKey="humidity" 
            fill="#3b82f6" 
            fillOpacity={0.6}
            name="Humidity (%)"
          />
          
          {/* Moisture as bars */}
          <Bar 
            yAxisId="left"
            dataKey="moisture" 
            fill="#10b981" 
            fillOpacity={0.6}
            name="Moisture (%)"
          />
          
          {/* Temperature as line (scaled) */}
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="scaledTemperature" 
            stroke="#a67c52" 
            strokeWidth={3}
            dot={{ fill: '#a67c52', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#8b6f47' }}
            name="Temperature (°C × 2.5)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MultiSensorChart;
