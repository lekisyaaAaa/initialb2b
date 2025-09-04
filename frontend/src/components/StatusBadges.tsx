import React from 'react';

interface StatusBadgeProps {
  status: 'normal' | 'warning' | 'critical' | string;
  children: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children, className = '' }) => {
  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'normal':
        return 'text-success-600 bg-success-100 dark:text-success-200 dark:bg-success-900';
      case 'warning':
        return 'text-warning-600 bg-warning-100 dark:text-warning-200 dark:bg-warning-900';
      case 'critical':
        return 'text-danger-600 bg-danger-100 dark:text-danger-200 dark:bg-danger-900';
      default:
        return 'text-coffee-600 bg-coffee-100 dark:text-coffee-200 dark:bg-coffee-900';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(status)} ${className}`}>
      {children}
    </span>
  );
};

interface SeverityBadgeProps {
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  children: React.ReactNode;
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, children, className = '' }) => {
  const getSeverityClasses = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-primary-600 bg-primary-100 dark:text-primary-200 dark:bg-primary-900';
      case 'medium':
        return 'text-warning-600 bg-warning-100 dark:text-warning-200 dark:bg-warning-900';
      case 'high':
        return 'text-letran-600 bg-letran-100 dark:text-letran-200 dark:bg-letran-900';
      case 'critical':
        return 'text-danger-600 bg-danger-100 dark:text-danger-200 dark:bg-danger-900';
      default:
        return 'text-espresso-600 bg-espresso-100 dark:text-espresso-200 dark:bg-espresso-900';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityClasses(severity)} ${className}`}>
      {children}
    </span>
  );
};
