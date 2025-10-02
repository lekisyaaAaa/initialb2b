import React from 'react';
import { motion } from 'framer-motion';

type Props = {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
};

const ActuatorControlCard: React.FC<Props> = ({ title, icon, children, status, className = '', header }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`p-4 rounded-xl border bg-white/80 dark:bg-gray-800/70 dark:border-gray-700 border-gray-100 shadow relative z-10 overflow-hidden min-h-[120px] flex flex-col justify-between ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</div>
              {status && <div className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">{status}</div>}
            </div>
          </div>
        </div>
        {header && <div className="ml-3">{header}</div>}
      </div>

      <div className="mt-3 flex-1 flex flex-col justify-between">{children}</div>
    </motion.div>
  );
};

export default ActuatorControlCard;
