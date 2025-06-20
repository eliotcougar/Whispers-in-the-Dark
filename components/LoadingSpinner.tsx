
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import { LoadingReason } from '../types';
import { LOADING_REASON_UI_MAP } from '../constants';
import { useLoadingProgress } from '../hooks/useLoadingProgress';

interface LoadingSpinnerProps {
  readonly loadingReason: LoadingReason | null;
}

/**
 * Displays a spinner with a reason message while the game is busy.
 */
function LoadingSpinner({ loadingReason = null }: LoadingSpinnerProps) {
  const { progress } = useLoadingProgress();
  const spinnerBaseClass = "rounded-full h-16 w-16 border-t-4 border-b-4";
  const spinnerClass = `${spinnerBaseClass} animate-spin border-sky-600`;
  const textColor = "text-sky-400";
  
  const entry = loadingReason ? LOADING_REASON_UI_MAP[loadingReason] : undefined;
  const textMessage =
    entry?.text ?? (loadingReason === null ? 'Hmmmmmm...' : 'Loading...');

  const progressDisplay = progress
    ? progress + progress.split('').reverse().join('')
    : '';

  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center my-8"
      role="status"
    >
      <div
        aria-hidden="true"
        className={spinnerClass}
      />

      <p className={`mt-2 text-xl ${textColor}`}>
        {textMessage}
      </p>

      {progressDisplay ? <div className="mt-2 text-2xl text-sky-300 font-mono">
        {progressDisplay}
      </div> : null}
    </div>
  );
}

export default LoadingSpinner;
