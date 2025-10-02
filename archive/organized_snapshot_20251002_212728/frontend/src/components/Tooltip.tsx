import React from 'react';

const Tooltip: React.FC<{ content: React.ReactNode; children: React.ReactNode }> = ({ content, children }) => {
  return (
    <span className="relative group inline-block">
      {children}
      <span className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 mt-2 w-max max-w-xs scale-0 transform rounded-md bg-gray-800 text-white text-xs px-2 py-1 group-hover:scale-100 transition-all">
        {content}
      </span>
    </span>
  );
};

export { Tooltip };
