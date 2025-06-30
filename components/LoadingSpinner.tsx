
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import { LOADING_REASON_UI_MAP } from '../constants';
import { useLoadingProgress } from '../hooks/useLoadingProgress';
import { useLoadingReason } from '../hooks/useLoadingReason';

/**
 * Displays a spinner with a reason message while the game is busy.
 */
function LoadingSpinner() {
  const loadingReason = useLoadingReason();
  const { progress, retryCount } = useLoadingProgress();
  const spinnerBaseClass = "rounded-full h-16 w-16 border-t-4 border-b-4";
  const spinnerClass = `${spinnerBaseClass} animate-spin border-sky-600`;
  const textColor = "text-sky-400";

  const entry = loadingReason ? LOADING_REASON_UI_MAP[loadingReason] : undefined;
  const textMessage = entry?.text ?? 'Loading...';

  const progressDisplay = progress
    ? progress + progress.split('').reverse().join('')
    : '';

  const retryDisplay = retryCount > 0 ? `Retry ${String(retryCount)}` : '';

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

      <p className={`mt-2 text-xl ${textColor} text-shadow-md`}>
        {textMessage}
      </p>

      {retryDisplay ? (
        <p className={`text-sm ${textColor} text-shadow-md mt-1`}>{retryDisplay}</p>
      ) : null}

      {progressDisplay ? (
        <div className="mt-2 text-2xl text-sky-300 font-mono text-shadow-md">
          {progressDisplay}
        </div>
      ) : null}
    </div>
  );
}

export default LoadingSpinner;
