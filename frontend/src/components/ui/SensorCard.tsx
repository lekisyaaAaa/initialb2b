import React from 'react';
import { SensorData } from '../../types';
import { Thermometer, Droplets, Battery, Sprout } from 'lucide-react';

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

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center space-x-2">
          <Thermometer className="h-4 w-4 text-red-600" />
          <span>{data.temperature}°C</span>
        </div>
        <div className="flex items-center space-x-2">
          <Droplets className="h-4 w-4 text-blue-600" />
          <span>{data.humidity}%</span>
        </div>
        <div className="flex items-center space-x-2">
          <Sprout className="h-4 w-4 text-green-600" />
          <span>{data.moisture}%</span>
        </div>
        <div className="flex items-center space-x-2">
          <Battery className="h-4 w-4 text-secondary-600" />
          <span>{data.batteryLevel ?? 'N/A'}%</span>
        </div>
      </div>

      {/* Additional sensor data */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {typeof data.ph === 'number' && (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6"/><path d="M7 8v6a5 5 0 0 0 10 0V8"/></svg>
            <span className="text-coffee-600 dark:text-gray-300">pH</span>
            <span className="ml-2 font-medium text-coffee-900 dark:text-white">{data.ph.toFixed(2)}</span>
          </div>
        )}
        {typeof data.ec === 'number' && (
          <div className="flex items-center space-x-2">
            <Droplets className="w-4 h-4 text-purple-600" />
            <span className="text-coffee-600 dark:text-gray-300">EC</span>
            <span className="ml-2 font-medium text-coffee-900 dark:text-white">{data.ec.toFixed(2)} mS/cm</span>
          </div>
        )}
        {typeof data.nitrogen === 'number' && (
          <div className="flex items-center space-x-2">
            <Sprout className="w-4 h-4 text-green-600" />
            <span className="text-coffee-600 dark:text-gray-300">N</span>
            <span className="ml-2 font-medium text-coffee-900 dark:text-white">{data.nitrogen} mg/kg</span>
          </div>
        )}
        {typeof data.phosphorus === 'number' && (
          <div className="flex items-center space-x-2">
            <Sprout className="w-4 h-4 text-orange-600" />
            <span className="text-coffee-600 dark:text-gray-300">P</span>
            <span className="ml-2 font-medium text-coffee-900 dark:text-white">{data.phosphorus} mg/kg</span>
          </div>
        )}
        {typeof data.potassium === 'number' && (
          <div className="flex items-center space-x-2">
            <Sprout className="w-4 h-4 text-yellow-600" />
            <span className="text-coffee-600 dark:text-gray-300">K</span>
            <span className="ml-2 font-medium text-coffee-900 dark:text-white">{data.potassium} mg/kg</span>
          </div>
        )}
        {typeof data.waterLevel === 'number' && (
          <div className="flex items-center space-x-2">
            <Droplets className="w-4 h-4 text-cyan-600" />
            <span className="text-coffee-600 dark:text-gray-300">Water</span>
            <span className="ml-2 font-medium text-coffee-900 dark:text-white">{data.waterLevel === 1 ? 'Present' : 'Low'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorCard;
