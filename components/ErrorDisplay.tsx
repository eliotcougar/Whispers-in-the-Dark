/**
 * @file ErrorDisplay.tsx
 * @description Shows an error message with optional retry.
 */

import Button from './elements/Button';
import { Icon } from './elements/icons';

interface ErrorDisplayProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

/**
 * Renders a flashing error message with an optional retry button.
 */
function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="bg-red-800 border border-red-600 text-red-100 p-6 rounded-lg shadow-xl my-4 animate-pulse">
      <div className="flex items-center mb-2">
        <Icon
          color="red"
          inline
          marginRight={12}
          name="error"
          size={32}
        />

        <h3 className="font-bold text-2xl text-red-200">
          A Shadow Falls!
        </h3>
      </div>

      <p className="text-red-200 mb-4">
        {message}
      </p>

      {onRetry ? (
        <Button
          ariaLabel="Try again after error"
          label="Try Again"
          onClick={onRetry}
          preset="red"
          size="md"
          variant="compact"
        />
      ) : null}
    </div>
  );
}

ErrorDisplay.defaultProps = {
  onRetry: undefined
};

export default ErrorDisplay;
