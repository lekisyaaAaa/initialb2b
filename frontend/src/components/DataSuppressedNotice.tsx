import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { suppressionReason } from '../utils/dataSuppression';

interface DataSuppressedNoticeProps {
  title?: string;
  instructions?: string;
}

const DataSuppressedNotice: React.FC<DataSuppressedNoticeProps> = ({
  title = 'Live telemetry is currently unavailable.',
  instructions = 'The dashboard has been intentionally locked to prevent raw or mock data from being shown. Please check back once sensors are re-enabled.',
}) => (
  <div className="min-h-[60vh] flex items-center justify-center px-4">
    <div className="max-w-2xl w-full rounded-2xl border border-amber-200 bg-amber-50 px-8 py-10 text-center shadow-lg dark:border-amber-800 dark:bg-amber-900/30">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow dark:bg-black/40">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-semibold text-amber-900 dark:text-amber-100">{title}</h1>
      <p className="mt-3 text-sm text-amber-800/90 dark:text-amber-200">{instructions}</p>
      <p className="mt-4 text-xs text-amber-700/80 dark:text-amber-300">{suppressionReason}</p>
    </div>
  </div>
);

export default DataSuppressedNotice;
