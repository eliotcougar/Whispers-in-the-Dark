/**
 * @file ModelUsageIndicators.tsx
 * @description Shows recent AI model usage levels.
 */
import { useModelUsage } from '../hooks/useModelUsage';

const squareClass = 'w-4 h-4 rounded';

const getColorClass = (pct: number) => {
  if (pct < 0.1) return 'bg-green-500';
  if (pct < 0.2) return 'bg-lime-500';
  if (pct < 0.3) return 'bg-yellow-500';
  if (pct < 0.4) return 'bg-orange-500';
  if (pct < 0.5) return 'bg-amber-500';
  return 'bg-red-500';
};

function ModelUsageIndicators() {
  const usage = useModelUsage();

  return (
    <div
      aria-label="Model usage last minute"
      className="flex space-x-1"
    >
      {Object.values(usage).map(info => {
        const pct = info.count / info.limit;
        const title = `${info.model}: ${String(info.count)}/${String(info.limit)} calls last minute`;
        return (
          <div
            aria-label={title}
            className={`${squareClass} ${getColorClass(pct)}`}
            key={info.model}
            title={title}
          />
        );
      })}
    </div>
  );
}

export default ModelUsageIndicators;
