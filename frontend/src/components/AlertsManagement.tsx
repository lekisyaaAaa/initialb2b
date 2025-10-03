import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, XCircle, AlertTriangle, Mail, MessageSquare, Settings, RefreshCw } from 'lucide-react';

interface Alert {
  _id: string;
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  status: 'new' | 'acknowledged' | 'resolved';
  deviceId?: string;
  createdAt: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
}

interface NotificationSettings {
  email: boolean;
  sms: boolean;
  criticalOnly: boolean;
  emailAddress: string;
}

interface AlertsManagementProps {
  alerts: Alert[];
  onAlertsChange?: (alerts: Alert[]) => void;
}

export const AlertsManagement: React.FC<AlertsManagementProps> = ({ alerts, onAlertsChange }) => {
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>(alerts);
  const [filter, setFilter] = useState<'all' | 'new' | 'acknowledged' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email: false,
    sms: false,
    criticalOnly: false,
    emailAddress: ''
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let filtered = alerts;

    if (filter !== 'all') {
      filtered = filtered.filter(alert => alert.status === filter);
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    setFilteredAlerts(filtered);
  }, [alerts, filter, severityFilter]);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.notifications) {
          setNotificationSettings(data.notifications);
        }
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved: true })
      });

      if (response.ok) {
        const updatedAlerts = alerts.map(alert =>
          alert._id === alertId
            ? { ...alert, status: 'resolved' as const, resolvedAt: new Date().toISOString() }
            : alert
        );
        onAlertsChange?.(updatedAlerts);
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'acknowledged', acknowledgedBy: 'admin' })
      });

      if (response.ok) {
        const updatedAlerts = alerts.map(alert =>
          alert._id === alertId
            ? { ...alert, status: 'acknowledged' as const, acknowledgedBy: 'admin' }
            : alert
        );
        onAlertsChange?.(updatedAlerts);
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolveAll = async () => {
    try {
      const response = await fetch('/api/alerts/resolve-all', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved: true })
      });

      if (response.ok) {
        const updatedAlerts = alerts.map(alert => ({
          ...alert,
          status: 'resolved' as const,
          resolvedAt: new Date().toISOString()
        }));
        onAlertsChange?.(updatedAlerts);
      }
    } catch (error) {
      console.error('Failed to resolve all alerts:', error);
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationSettings)
      });

      if (response.ok) {
        setShowSettings(false);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      alert('Failed to save notification settings. Please try again.');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'low': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'acknowledged': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'resolved': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const unreadCount = alerts.filter(a => a.status === 'new').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Alerts & Notifications Management
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monitor and manage system alerts and notification settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-2 text-sm rounded-md border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleResolveAll}
            disabled={alerts.filter(a => a.status !== 'resolved').length === 0}
            className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Resolve All
          </button>
        </div>
      </div>

      {/* Notification Settings Panel */}
      {showSettings && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-4">
            Notification Settings
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Email Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.email}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, email: e.target.checked }))}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">SMS Notifications</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.sms}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, sms: e.target.checked }))}
                  className="rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Critical Alerts Only</span>
                <input
                  type="checkbox"
                  checked={notificationSettings.criticalOnly}
                  onChange={(e) => setNotificationSettings(prev => ({ ...prev, criticalOnly: e.target.checked }))}
                  className="rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alert Email Address
              </label>
              <input
                type="email"
                value={notificationSettings.emailAddress}
                onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailAddress: e.target.value }))}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 rounded-md border"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotificationSettings}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status Filter
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Severity Filter
          </label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-end">
          <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-md text-sm font-medium">
            {unreadCount} unread alerts
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No alerts match the current filters</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert._id}
              className={`p-4 rounded-lg border ${
                alert.status === 'new'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                  : alert.status === 'acknowledged'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {getSeverityIcon(alert.severity)}
                      <span className="ml-1 capitalize">{alert.severity}</span>
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </span>
                    {alert.deviceId && (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                        {alert.deviceId}
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">
                    {alert.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {alert.message}
                  </p>

                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Created: {new Date(alert.createdAt).toLocaleString()}</span>
                    {alert.acknowledgedBy && (
                      <span>Acknowledged by: {alert.acknowledgedBy}</span>
                    )}
                    {alert.resolvedAt && (
                      <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert._id)}
                      className="px-3 py-1 text-xs rounded border bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                      title="Acknowledge alert"
                    >
                      Acknowledge
                    </button>
                  )}

                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolveAlert(alert._id)}
                      className="px-3 py-1 text-xs rounded border bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30"
                      title="Resolve alert"
                    >
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Channels Summary */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
          Notification Channels
        </h4>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <Mail className={`w-4 h-4 ${notificationSettings.email ? 'text-green-600' : 'text-gray-400'}`} />
            <span className={notificationSettings.email ? 'text-green-600' : 'text-gray-400'}>
              Email {notificationSettings.email ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <MessageSquare className={`w-4 h-4 ${notificationSettings.sms ? 'text-green-600' : 'text-gray-400'}`} />
            <span className={notificationSettings.sms ? 'text-green-600' : 'text-gray-400'}>
              SMS {notificationSettings.sms ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {notificationSettings.criticalOnly ? 'Critical alerts only' : 'All alerts'}
          </div>
        </div>
      </div>
    </div>
  );
};