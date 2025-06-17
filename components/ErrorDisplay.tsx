
/**
 * @file ErrorDisplay.tsx
 * @description Shows an error message with optional retry.
 */
import React from 'react';

interface ErrorDisplayProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

/**
 * Renders a flashing error message with an optional retry button.
 */
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => (
  <div className="bg-red-800 border border-red-600 text-red-100 p-6 rounded-lg shadow-xl my-4 animate-pulse">
    <div className="flex items-center mb-2">
      <svg className="h-8 w-8 mr-3 text-red-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" fillRule="evenodd" />
      </svg>

      <h3 className="font-bold text-2xl text-red-200">A Shadow Falls!</h3>
    </div>

    <p className="text-red-200 mb-4">{message}</p>

    {onRetry ? <button
      className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded shadow transition duration-150 ease-in-out"
      onClick={onRetry}
      >
        Try Again
      </button> : null}
  </div>
);

export default ErrorDisplay;
