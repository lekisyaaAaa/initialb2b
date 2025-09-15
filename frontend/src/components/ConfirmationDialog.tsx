import React from 'react';

const ConfirmationDialog: React.FC<{ open: boolean; title?: string; message?: string; onConfirm: ()=>void; onCancel: ()=>void }> = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">{title || 'Confirm'}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message || 'Are you sure?'}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">Confirm</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
