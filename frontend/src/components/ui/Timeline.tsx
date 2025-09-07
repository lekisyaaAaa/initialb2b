import React from 'react';
import { motion } from 'framer-motion';

interface EventItem { id: string; title: string; time: string; description?: string }

const Timeline: React.FC<{ events: EventItem[] }> = ({ events }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border">
      <h3 className="text-sm font-semibold text-espresso-900 mb-3">Timeline</h3>
      <ol className="space-y-3">
        {events.map(e => (
          <motion.li key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="flex items-start space-x-3">
            <div className="w-2 h-2 rounded-full bg-primary-600 mt-2"></div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-gray-400">{e.time}</p>
              </div>
              {e.description && <p className="text-xs text-gray-500 mt-1">{e.description}</p>}
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
};

export default Timeline;
