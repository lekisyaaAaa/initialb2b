import React from 'react';
import { motion } from 'framer-motion';

type Props = {
  label: string;
  variant?: 'primary' | 'danger' | 'neutral' | 'accent';
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
  className?: string;
};

const variantClass: Record<string, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  neutral: 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
  accent: 'bg-indigo-600 text-white hover:bg-indigo-700',
};

const ActuatorButton: React.FC<Props> = ({ label, variant = 'neutral', onClick, loading, disabled, tooltip, className = '' }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip}
      className={`w-full h-10 flex items-center justify-center px-3 rounded-md text-sm ${variantClass[variant]} ${disabled || loading ? 'opacity-60 cursor-not-allowed' : 'transition-transform hover:scale-[1.01]'} ${className}`}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : label}
    </motion.button>
  );
};

export default ActuatorButton;
