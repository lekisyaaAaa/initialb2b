import React from 'react';
import { SensorData } from '../../types';
import { Thermometer, Droplets, Battery } from 'lucide-react';

interface Props { data: SensorData }

const SensorCard: React.FC<Props> = ({ data }) => {
  return (
  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-coffee-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-espresso-600">{data.deviceId}</p>
          <p className="text-xs text-gray-500">{new Date(data.timestamp).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-espresso-900">{data.temperature}°C</p>
          <p className="text-sm text-gray-500">Temp</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div className="flex items-center space-x-2">
          <Thermometer className="h-4 w-4 text-primary-600" />
          <span>{data.temperature}°C</span>
        </div>
        <div className="flex items-center space-x-2">
          <Droplets className="h-4 w-4 text-primary-600" />
          <span>{data.humidity}%</span>
        </div>
        <div className="flex items-center space-x-2">
          <Battery className="h-4 w-4 text-primary-600" />
          <span>{data.batteryLevel ?? 'N/A'}%</span>
        </div>
      </div>
    </div>
  );
};

export default SensorCard;
