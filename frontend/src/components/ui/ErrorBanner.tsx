import React from 'react';

interface Props {
  message?: string | null;
  onClose?: () => void;
}

const ErrorBanner: React.FC<Props> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="w-full bg-danger-50 dark:bg-red-900/40 border border-danger-200 dark:border-red-700 rounded-md p-3 mb-4 flex items-start justify-between">
      <div className="flex items-start space-x-3">
        <svg className="h-5 w-5 text-danger-600 dark:text-red-300 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.68-1.36 3.445 0l6.518 11.59c.75 1.334-.213 2.992-1.722 2.992H3.461c-1.51 0-2.472-1.658-1.722-2.992L8.257 3.1zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-.993.883L9 6v4a1 1 0 001.993.117L11 10V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        <div>
          <p className="text-sm font-semibold text-danger-700 dark:text-red-200">Data fetch failed</p>
          <p className="text-sm text-danger-700 dark:text-red-100 opacity-90">{message}</p>
        </div>
      </div>
      <div className="pl-4">
        <button onClick={onClose} className="text-sm text-danger-700 dark:text-red-200 hover:underline">Dismiss</button>
      </div>
    </div>
  );
};

export default ErrorBanner;
