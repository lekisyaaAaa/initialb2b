import React, { useState, useMemo } from 'react';
import { Calendar, Filter, TrendingUp, BarChart3 } from 'lucide-react';
import { SensorData } from '../../types';
import TemperatureChart from './TemperatureChart';
import HumidityChart from './HumidityChart';
import MoistureChart from './MoistureChart';
import MultiSensorChart from './MultiSensorChart';

interface ChartContainerProps {
  data: SensorData[];
  title: string;
  deviceId?: string;
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';
type ChartType = 'temperature' | 'humidity' | 'moisture' | 'multi';

const ChartContainer: React.FC<ChartContainerProps> = ({ data, title, deviceId }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [chartType, setChartType] = useState<ChartType>('multi');

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const now = new Date();
    const ranges = {
      '1h': 1 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const cutoff = new Date(now.getTime() - ranges[timeRange]);
    
    let filtered = data.filter(item => {
      const itemTime = new Date(item.timestamp);
      return itemTime >= cutoff;
    });

    // If filtering by device, apply that filter
    if (deviceId) {
      filtered = filtered.filter(item => item.deviceId === deviceId);
    }

    // Sort by timestamp
    return filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [data, timeRange, deviceId]);

  const timeRangeOptions = [
    { value: '1h', label: '1 Hour' },
    { value: '6h', label: '6 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
  ];

  const chartTypeOptions = [
    { value: 'multi', label: 'All Sensors', icon: BarChart3 },
    { value: 'temperature', label: 'Temperature', icon: TrendingUp },
    { value: 'humidity', label: 'Humidity', icon: TrendingUp },
    { value: 'moisture', label: 'Moisture', icon: TrendingUp },
  ];

  const renderChart = () => {
    const chartHeight = 350;
    
    switch (chartType) {
      case 'temperature':
        return <TemperatureChart data={filteredData} height={chartHeight} />;
      case 'humidity':
        return <HumidityChart data={filteredData} height={chartHeight} />;
      case 'moisture':
        return <MoistureChart data={filteredData} height={chartHeight} />;
      case 'multi':
      default:
        return <MultiSensorChart data={filteredData} height={chartHeight} />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-coffee-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-coffee-600 to-coffee-700 text-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {deviceId && (
              <p className="text-coffee-100 text-sm">Device: {deviceId}</p>
            )}
            <p className="text-coffee-200 text-sm">
              {filteredData.length} data points
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Last updated: {
              filteredData.length > 0 
                ? new Date(filteredData[filteredData.length - 1].timestamp).toLocaleTimeString()
                : 'No data'
            }</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-coffee-50 p-4 border-b border-coffee-200">
        <div className="flex flex-wrap items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-coffee-600" />
            <span className="text-sm font-medium text-coffee-700">Time Range:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="bg-white dark:bg-gray-700 border border-coffee-300 dark:border-gray-600 rounded-md px-3 py-1 text-sm text-coffee-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-coffee-500"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-coffee-600" />
            <span className="text-sm font-medium text-coffee-700">Chart Type:</span>
            <div className="flex space-x-1">
              {chartTypeOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setChartType(option.value as ChartType)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        chartType === option.value
                          ? 'bg-coffee-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-coffee-600 dark:text-white hover:bg-coffee-100 dark:hover:bg-gray-700 border border-coffee-300 dark:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center space-x-1">
                      <Icon className="w-3 h-3" />
                      <span>{option.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {filteredData.length > 0 ? (
          renderChart()
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-coffee-500">
            <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Data Available</p>
            <p className="text-sm">No sensor data found for the selected time range.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartContainer;
