import React from 'react';
import { Tooltip } from './Tooltip';

type SensorProps = {
  id: string;
  label: string;
  value: number | null | undefined;
  unit?: string;
  icon?: React.ReactNode;
  thresholds?: { ok: [number, number]; warn?: [number, number]; critical?: [number, number] };
  hint?: string;
  className?: string;
  alert?: boolean;
};

function colorForValue(v: number | null | undefined, t?: SensorProps['thresholds']) {
  if (v == null) return 'text-gray-400';
  if (!t) return 'text-gray-900';
  const n = v;
  if (t.critical && n >= t.critical[0] && n <= t.critical[1]) return 'text-red-600';
  if (t.warn && n >= t.warn[0] && n <= t.warn[1]) return 'text-amber-600';
  if (t.ok && n >= t.ok[0] && n <= t.ok[1]) return 'text-green-600';
  return 'text-gray-900';
}

const SensorCard: React.FC<SensorProps> = ({ id, label, value, unit, icon, thresholds, hint, className = '', alert = false }) => {
  const val = value == null ? '—' : `${value}${unit ? ` ${unit}` : ''}`;
  return (
    <div className={`box-border p-5 rounded-2xl bg-white dark:bg-gray-900 border ${alert ? 'border-red-500 shadow-red-200/40 animate-pulse' : 'border-gray-100 dark:border-gray-800 shadow-sm'} transition-transform transform hover:-translate-y-1 hover:shadow-lg min-w-0 ${className}`} role="group" aria-labelledby={`sensor-${id}`}>
      <div className="flex flex-col items-center justify-center text-center h-full min-h-[140px] gap-3">
        <div className="flex items-center justify-center text-3xl w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-800 text-primary-600">{icon}</div>
        <div className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${colorForValue(value, thresholds)}`} id={`sensor-${id}`}>{val}</div>
        <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">{label}</div>
        {hint && (
          <div className="text-xs text-gray-500 mt-1">
            <Tooltip content={hint}><span className="underline cursor-help">Info</span></Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default SensorCard;
