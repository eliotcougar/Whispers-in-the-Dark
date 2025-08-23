

/**
 * @file ConfirmationDialog.tsx
 * @description Modal dialog to confirm user actions.
 */
import { useCallback } from 'react';
import Button, { type ButtonProps } from './elements/Button';

import * as React from 'react';

interface ConfirmationDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly message: React.ReactNode; // Allow JSX for message content
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly confirmPreset?: ButtonProps['preset'];
}

/**
 * Modal dialog prompting the user to confirm or cancel an action.
 */
function ConfirmationDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmPreset = 'sky',
}: ConfirmationDialogProps) {
  const stopPropagation = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);
  if (!isOpen) return null;

  const displayMessage = message;


  return (
    <div 
      aria-labelledby="confirmation-dialog-title"
      aria-modal="true"
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" // Increased z-index and added blur
      onClick={onCancel} // Allow closing by clicking overlay
      role="dialog"
    >
      <div 
        className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg transform transition-all duration-300 ease-out scale-95 opacity-0 animate-dialog-enter"
        onClick={stopPropagation} // Prevent dialog close when clicking inside
        style={{animationFillMode: 'forwards'}} // Keep final state of animation
      >
        <h2
          className="text-2xl font-bold text-sky-300 mb-5"
          id="confirmation-dialog-title"
        >
          {title}
        </h2>

        <div className="text-slate-300 mb-8 text-base leading-relaxed">
          {displayMessage}
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            ariaLabel={cancelText}
            label={cancelText}
            onClick={onCancel}
            preset="slate"
            size="md"
            variant="compact"
          />

          <Button
            ariaLabel={confirmText}
            label={confirmText}
            onClick={onConfirm}
            preset={confirmPreset}
            size="md"
            variant="compact"
          />
        </div>
      </div>

      {/* Removed non-standard 'jsx' and 'global' attributes from style tag */}
      <style>
        {`
        @keyframes dialog-enter {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-dialog-enter {
          animation: dialog-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}
      </style>
    </div>
  );
}

ConfirmationDialog.defaultProps = {
  cancelText: 'Cancel',
  confirmPreset: 'sky',
  confirmText: 'Confirm',
};

export default ConfirmationDialog;
