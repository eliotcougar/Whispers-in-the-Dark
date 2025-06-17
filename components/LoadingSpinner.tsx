
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import React from 'react';
import { LoadingReason } from '../types';
import { LOADING_REASON_UI_MAP } from '../constants';
import { useLoadingProgress } from '../hooks/useLoadingProgress';

interface LoadingSpinnerProps {
  loadingReason?: LoadingReason;
}

/**
 * Displays a spinner with a reason message while the game is busy.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingReason }) => {
  const { progress } = useLoadingProgress();
  const spinnerBaseClass = "rounded-full h-16 w-16 border-t-4 border-b-4";
  const spinnerClass = `${spinnerBaseClass} animate-spin border-sky-600`;
  const textColor = "text-sky-400";
  
  const textMessage =
    loadingReason && LOADING_REASON_UI_MAP[loadingReason]
      ? LOADING_REASON_UI_MAP[loadingReason].text
      : loadingReason === null
      ? 'Hmmmmmm...'
      : 'Loading...';

  const progressDisplay = progress
    ? progress + progress.split('').reverse().join('')
    : '';

  return (
    <div
      className={`flex flex-col items-center my-8`}
      role="status"
      aria-live="polite"
    >
      <div className={spinnerClass} aria-hidden="true"></div>
      <p className={`mt-2 text-xl ${textColor}`}>{textMessage}</p>
      {progressDisplay && (
        <div className="mt-2 text-2xl text-sky-300 font-mono">
          {progressDisplay}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
