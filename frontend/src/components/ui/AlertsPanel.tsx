import React from 'react';
import { Alert } from '../../types';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Props { alerts: Alert[] }

const AlertsPanel: React.FC<Props> = ({ alerts }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-espresso-900">Active Alerts</h3>
        <span className="text-xs text-gray-500">{alerts.length} total</span>
      </div>

      {alerts.length === 0 ? (
        <div className="text-sm text-gray-500">No active alerts</div>
      ) : (
        <ul className="space-y-3">
          {alerts.map(a => (
            <li key={a._id} className="flex items-start space-x-3">
              <div className={`p-2 rounded-md ${a.isResolved ? 'bg-green-50' : 'bg-red-50'}`}>
                {a.isResolved ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-espresso-900">{a.type.replace('_', ' ').toUpperCase()}</p>
                  <p className="text-xs text-gray-400">{format(new Date(a.createdAt), 'MMM dd, HH:mm')}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">{a.message}</p>
                <div className="mt-2 text-xs text-gray-400 flex items-center justify-between">
                  <span>Device: {a.deviceId}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium">
                    {a.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AlertsPanel;
