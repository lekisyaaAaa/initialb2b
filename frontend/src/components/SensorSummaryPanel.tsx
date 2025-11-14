import React, { useMemo } from 'react';
import { ExternalLink, RefreshCw, Activity } from 'lucide-react';
import { useSensorsPolling } from '../hooks/useSensorsPolling';
import { SensorData, SensorSummaryItem } from '../types';

interface SensorSummaryPanelProps {
  className?: string;
  deviceId?: string;
}

const resolveHomeAssistantUrl = (): string => {
  const envUrl =
    process.env.REACT_APP_HOME_ASSISTANT_URL ||
    process.env.VITE_HOME_ASSISTANT_URL ||
    process.env.NEXT_PUBLIC_HOME_ASSISTANT_URL ||
    '';

  const globalUrl =
    typeof window !== 'undefined' && (window as any).__HOME_ASSISTANT_URL__
      ? String((window as any).__HOME_ASSISTANT_URL__)
      : '';

  const candidate = envUrl || globalUrl;
  if (candidate) {
    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }
    if (typeof window !== 'undefined' && window.location) {
      const base = window.location.origin.replace(/\/$/, '');
      const normalized = candidate.startsWith('/') ? candidate : `/${candidate}`;
      return `${base}${normalized}`;
    }
    return candidate;
  }

  return 'https://yvhqbpr07mrxznxn0azgwpnynntpvvpf.ui.nabu.casa';
};

const formatValue = (item: SensorSummaryItem): string => {
  const { value, unit } = item;
  if (value === null || typeof value === 'undefined') {
    return '—';
  }
  if (typeof value === 'number') {
    const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
    return `${rounded}${unit ? ` ${unit}` : ''}`.trim();
  }
  if (typeof value === 'object') {
    const segments = Object.entries(value)
      .filter(([, segmentValue]) => segmentValue !== null && typeof segmentValue !== 'undefined')
      .map(([label, segmentValue]) => `${label}: ${segmentValue}`);
    return segments.length > 0 ? segments.join(' · ') : '—';
  }
  return String(value);
};

const buildFallbackSummary = (latest: SensorData | null): SensorSummaryItem[] => {
  if (!latest) {
    return [];
  }
  const candidates: Array<[string, string, number | undefined, string | null]> = [
    ['temperature', 'Temperature', latest.temperature, '°C'],
    ['humidity', 'Humidity', latest.humidity, '%'],
    ['moisture', 'Soil Moisture', latest.moisture, '%'],
    ['ph', 'pH', latest.ph, null],
    ['ec', 'EC', latest.ec, 'mS/cm'],
    ['waterLevel', 'Water Level', latest.waterLevel, latest.waterLevel != null ? (latest.waterLevel <= 0 ? null : 'cm') : null],
    ['batteryLevel', 'Battery', latest.batteryLevel, latest.batteryLevel != null ? '%' : null],
  ];

  return candidates
    .filter(([, , value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, label, value, unit]) => ({
      key,
      label,
      value: value as number,
      unit: unit ?? undefined,
      timestamp: latest.timestamp ? String(latest.timestamp) : undefined,
    }));
};

const SensorSummaryPanel: React.FC<SensorSummaryPanelProps> = ({ className = '', deviceId }) => {
  const { latest, status, error, refresh, isPolling, lastUpdated } = useSensorsPolling({
    deviceId,
    intervalMs: 5000,
    maxIntervalMs: 60000,
    cacheTtlMs: 2500,
  });

  const summaryItems = useMemo(() => {
    if (latest && Array.isArray(latest.sensorSummary) && latest.sensorSummary.length > 0) {
      return latest.sensorSummary;
    }
    return buildFallbackSummary(latest);
  }, [latest]);

  const homeAssistantUrl = useMemo(resolveHomeAssistantUrl, []);
  const lastUpdatedText = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never';

  return (
    <section
      className={`rounded-2xl border border-gray-100 bg-white/80 p-6 shadow transition dark:border-gray-800 dark:bg-gray-900/70 ${className}`}
    >
      <header className="flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-50">Sensor Overview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Latest field telemetry with adaptive polling and automatic backoff when offline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Last update: {lastUpdatedText}</span>
          <button
            type="button"
            onClick={() => refresh()}
            className={`inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 font-medium transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 ${
              isPolling ? 'opacity-60' : ''
            }`}
            disabled={isPolling}
          >
            <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {status === 'error' ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      ) : summaryItems.length === 0 && status === 'loading' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800"
            >
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-3 h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryItems.map((item) => (
            <li
              key={item.key}
              className="rounded-xl border border-gray-100 bg-white/90 p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900/60"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {formatValue(item)}
              </div>
              {item.timestamp && (
                <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Observed {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              )}
            </li>
          ))}
          {summaryItems.length === 0 && status === 'success' && (
            <li className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
              No recent sensor readings. Data will appear automatically when devices report in.
            </li>
          )}
        </ul>
      )}

      <footer className="mt-6 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200 md:flex-row md:items-center md:justify-between">
        <div>
          Looking for actuator controls? Those are now handled exclusively through VermiLinks Actuators.
        </div>
        <a
          href={homeAssistantUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Open VermiLinks Actuators
          <ExternalLink className="h-4 w-4" />
        </a>
      </footer>
    </section>
  );
};

export default SensorSummaryPanel;
