
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import { LOADING_REASON_UI_MAP } from '../constants';
import { useLoadingProgress } from '../hooks/useLoadingProgress';
import { useLoadingReason } from '../hooks/useLoadingReason';

interface LoadingSpinnerProps {
  readonly className?: string;
  readonly showText?: boolean;
  readonly size?: 'lg' | 'sm';
}

/**
 * Displays a spinner with an optional reason message while the game is busy.
 */
function LoadingSpinner({ className = '', showText = true, size = 'lg' }: LoadingSpinnerProps) {
  const loadingReason = useLoadingReason();
  const { progress, retryCount } = useLoadingProgress();
  const spinnerBaseClass =
    size === 'sm'
      ? 'rounded-full h-6 w-6 border-t-2 border-b-2'
      : 'rounded-full h-16 w-16 border-t-4 border-b-4';
  const spinnerClass = `${spinnerBaseClass} animate-spin border-sky-600`;
  const textColor = 'text-sky-400';

  const entry = loadingReason ? LOADING_REASON_UI_MAP[loadingReason] : undefined;
  const textMessage = entry?.text ?? 'Loading...';

  const progressDisplay = progress
    ? progress + progress.split('').reverse().join('')
    : '';

  const retryDisplay = retryCount > 0 ? `Retry ${String(retryCount)}` : '';

  const containerClass = showText ? 'flex flex-col items-center my-8' : '';

  return (
    <div
      aria-live="polite"
      className={`${containerClass} ${className}`}
      role="status"
    >
      <div
        aria-hidden="true"
        className={spinnerClass}
      />

      {showText ? (
        <>
          <p className={`mt-2 text-xl ${textColor} text-shadow-md`}>
            {textMessage}
          </p>

          {retryDisplay ? (
            <p className={`mt-1 text-sm ${textColor} text-shadow-md`}>
              {retryDisplay}
            </p>
          ) : null}

          {progressDisplay ? (
            <div className="mt-2 text-2xl text-sky-300 font-mono text-shadow-md">
              {progressDisplay}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default LoadingSpinner;

LoadingSpinner.defaultProps = {
  className: '',
  showText: true,
  size: 'lg',
} as const;
