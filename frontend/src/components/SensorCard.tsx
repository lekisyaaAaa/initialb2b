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

const SensorCard: React.FC<SensorProps> = ({ id, label, value, unit, icon, thresholds, hint, className = '' }) => {
  const val = value == null ? '—' : `${value}${unit ? ` ${unit}` : ''}`;
  return (
    <div className={`box-border p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm transition-transform transform hover:-translate-y-1 hover:shadow-lg min-w-0 ${className}`}>
      <div className="flex flex-col h-full min-h-[128px]">
        <div className="flex items-center gap-4">
          <div className="text-primary-600 dark:text-primary-400 flex-shrink-0 text-2xl">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</div>
              <div className={`text-2xl font-extrabold tracking-tight whitespace-nowrap ${colorForValue(value, thresholds)}`}>{val}</div>
            </div>
            {hint && <div className="text-xs text-gray-500 mt-2"><Tooltip content={hint}><span className="underline cursor-help">Range info</span></Tooltip></div>}
          </div>
        </div>
        <div className="mt-auto" />
      </div>
    </div>
  );
};

export default SensorCard;
