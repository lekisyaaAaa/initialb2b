import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type LogEntry = { id: string; timestamp: string; message: string };

const ActuatorLogs: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/actuators/logs?limit=5');
        if (!res.ok) return setLogs([]);
        const body = await res.json();
        setLogs((body.logs || []).map((l: any) => ({ id: String(l.id), timestamp: l.timestamp, message: `${l.actuatorType} ${l.action}` })));
      } catch (e) {
        setLogs([]);
      }
    }
    load();
  }, []);

  return (
    <div className={`rounded-xl border p-3 bg-white/80 dark:bg-gray-800/70 border-gray-100 dark:border-gray-700 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Recent Actuator Logs</div>
        <button onClick={() => setOpen(v => !v)} className="text-xs text-gray-500">{open ? 'Hide' : 'Show'}</button>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.18 }} className="mt-2 overflow-auto">
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 max-h-40">
            {logs.length === 0 ? <div className="text-gray-500">No recent actions</div> : logs.map(l => (
              <div key={l.id} className="flex items-center justify-between">
                <div>{l.message}</div>
                <div className="text-xs text-gray-400">{new Date(l.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ActuatorLogs;
