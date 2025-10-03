import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface Thresholds {
  temperature: {
    min: number;
    max: number;
    warning: number;
    critical: number;
  };
  humidity: {
    min: number;
    max: number;
    warning: number;
    critical: number;
  };
  moisture: {
    min: number;
    max: number;
    warning: number;
    critical: number;
  };
  ph: {
    min: number;
    max: number;
    warning: number;
    critical: number;
  };
  ec: {
    min: number;
    max: number;
    warning: number;
    critical: number;
  };
}

interface ThresholdConfigurationProps {
  onThresholdsChange?: (thresholds: Thresholds) => void;
}

export const ThresholdConfiguration: React.FC<ThresholdConfigurationProps> = ({ onThresholdsChange }) => {
  const [thresholds, setThresholds] = useState<Thresholds>({
    temperature: { min: 18, max: 30, warning: 25, critical: 32 },
    humidity: { min: 40, max: 70, warning: 65, critical: 75 },
    moisture: { min: 30, max: 60, warning: 35, critical: 25 },
    ph: { min: 6.0, max: 8.0, warning: 5.5, critical: 5.0 },
    ec: { min: 0, max: 2000, warning: 1500, critical: 2500 }
  });

  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.thresholds) {
          setThresholds(data.thresholds);
          setLastSaved(new Date());
        }
      }
    } catch (error) {
      console.error('Failed to load thresholds:', error);
    }
  };

  const handleThresholdChange = (sensor: keyof Thresholds, field: string, value: number) => {
    setThresholds(prev => ({
      ...prev,
      [sensor]: {
        ...prev[sensor],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const validateThresholds = (): string[] => {
    const errors: string[] = [];

    Object.entries(thresholds).forEach(([sensor, config]) => {
      if (config.min >= config.max) {
        errors.push(`${sensor}: Min must be less than Max`);
      }
      if (config.warning >= config.critical) {
        errors.push(`${sensor}: Warning must be less than Critical`);
      }
      // For moisture, low values are critical, so warning should be higher than critical
      if (sensor === 'moisture') {
        if (config.warning <= config.critical) {
          errors.push(`${sensor}: Warning must be greater than Critical for moisture`);
        }
      }
    });

    return errors;
  };

  const handleSave = async () => {
    const errors = validateThresholds();
    if (errors.length > 0) {
      alert(`Validation errors:\n${errors.join('\n')}`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/settings/thresholds', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thresholds })
      });

      if (response.ok) {
        setLastSaved(new Date());
        setHasChanges(false);
        onThresholdsChange?.(thresholds);
      } else {
        throw new Error('Failed to save thresholds');
      }
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      alert('Failed to save thresholds. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sensorConfigs = [
    {
      key: 'temperature' as keyof Thresholds,
      label: 'Temperature',
      unit: '°C',
      description: 'Optimal range: 18-30°C'
    },
    {
      key: 'humidity' as keyof Thresholds,
      label: 'Humidity',
      unit: '%',
      description: 'Optimal range: 40-70%'
    },
    {
      key: 'moisture' as keyof Thresholds,
      label: 'Soil Moisture',
      unit: '%',
      description: 'Optimal range: 30-60%'
    },
    {
      key: 'ph' as keyof Thresholds,
      label: 'pH Level',
      unit: '',
      description: 'Optimal range: 6.0-8.0'
    },
    {
      key: 'ec' as keyof Thresholds,
      label: 'EC (Conductivity)',
      unit: 'µS/cm',
      description: 'Electrical conductivity'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Threshold & Rules Configuration
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure sensor thresholds for automatic alerts and monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadThresholds}
            className="px-3 py-2 text-sm rounded-md border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh thresholds"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              You have unsaved changes. Click "Save Changes" to apply them.
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {sensorConfigs.map((config) => (
          <div key={config.key} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200">
                  {config.label}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {config.description}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Current Range</div>
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  {thresholds[config.key].min} - {thresholds[config.key].max} {config.unit}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Value ({config.unit})
                </label>
                <input
                  type="number"
                  step={config.key === 'ph' ? '0.1' : '1'}
                  value={thresholds[config.key].min}
                  onChange={(e) => handleThresholdChange(config.key, 'min', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Value ({config.unit})
                </label>
                <input
                  type="number"
                  step={config.key === 'ph' ? '0.1' : '1'}
                  value={thresholds[config.key].max}
                  onChange={(e) => handleThresholdChange(config.key, 'max', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Warning Threshold ({config.unit})
                </label>
                <input
                  type="number"
                  step={config.key === 'ph' ? '0.1' : '1'}
                  value={thresholds[config.key].warning}
                  onChange={(e) => handleThresholdChange(config.key, 'warning', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Critical Threshold ({config.unit})
                </label>
                <input
                  type="number"
                  step={config.key === 'ph' ? '0.1' : '1'}
                  value={thresholds[config.key].critical}
                  onChange={(e) => handleThresholdChange(config.key, 'critical', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Alert Logic:</span>
                <div className="flex items-center space-x-4">
                  <span className="text-green-600">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Normal: {thresholds[config.key].min} - {thresholds[config.key].max}
                  </span>
                  <span className="text-yellow-600">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Warning: {config.key === 'moisture' ? `≤ ${thresholds[config.key].warning}` : `≥ ${thresholds[config.key].warning}`}
                  </span>
                  <span className="text-red-600">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Critical: {config.key === 'moisture' ? `≤ ${thresholds[config.key].critical}` : `≥ ${thresholds[config.key].critical}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          Alert Behavior
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <li>• Alerts are triggered automatically when sensor readings exceed thresholds</li>
          <li>• Critical alerts are sent immediately via configured notification channels</li>
          <li>• Warning alerts are logged but may have different notification settings</li>
          <li>• Threshold changes take effect immediately after saving</li>
        </ul>
      </div>
    </div>
  );
};