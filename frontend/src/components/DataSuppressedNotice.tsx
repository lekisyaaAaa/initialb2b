import React from 'react';

interface DataSuppressedNoticeProps {
  title?: string;
  instructions?: string;
}

const DataSuppressedNotice: React.FC<DataSuppressedNoticeProps> = ({
  title = 'Telemetry Unavailable',
  instructions = 'Live sensor data and logs are hidden for this deployment.'
}) => (
  <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-6 text-center">
    <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">{title}</h2>
    <p className="text-sm text-yellow-700 dark:text-yellow-100">{instructions}</p>
  </div>
);

export default DataSuppressedNotice;
