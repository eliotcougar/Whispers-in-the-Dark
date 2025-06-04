

/**
 * @file ConfirmationDialog.tsx
 * @description Modal dialog to confirm user actions.
 */
import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode; // Allow JSX for message content
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string; 
  isCustomModeShift?: boolean; // New prop
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "bg-sky-600 hover:bg-sky-500",
  isCustomModeShift, // Destructure new prop
}) => {
  if (!isOpen) return null;

  let displayMessage = message;
  if (title === "Confirm Reality Shift" && isCustomModeShift) {
    displayMessage = (
      <>
        This will allow you to choose a new theme to shift to. 
        The current adventure will be summarized. Are you sure you wish to proceed?
      </>
    );
  }


  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" // Increased z-index and added blur
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      onClick={onCancel} // Allow closing by clicking overlay
    >
      <div 
        className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg transform transition-all duration-300 ease-out scale-95 opacity-0 animate-dialog-enter"
        onClick={(e) => e.stopPropagation()} // Prevent dialog close when clicking inside
        style={{animationFillMode: 'forwards'}} // Keep final state of animation
      >
        <h2 id="confirmation-dialog-title" className="text-2xl font-bold text-sky-300 mb-5">{title}</h2>
        <div className="text-slate-300 mb-8 text-base leading-relaxed">{displayMessage}</div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-white font-semibold rounded-lg shadow-md transition-all duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 ${confirmButtonClass} focus:ring-opacity-75`}
            aria-label={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
      {/* Removed non-standard 'jsx' and 'global' attributes from style tag */}
      <style>{`
        @keyframes dialog-enter {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-dialog-enter {
          animation: dialog-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default ConfirmationDialog;
