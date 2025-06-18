// Utility to track AI model usage within the last minute
import {
  GEMINI_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  MINIMAL_MODEL_NAME,
} from '../constants';

const usageHistories: Record<string, number[] | undefined> = {
  [GEMINI_MODEL_NAME]: [],
  [AUXILIARY_MODEL_NAME]: [],
  [MINIMAL_MODEL_NAME]: [],
};

let subscribers: Array<() => void> = [];

const purgeOld = () => {
  const cutoff = Date.now() - 60_000;
  Object.values(usageHistories).forEach(arr => {
    if (!arr) return;
    while (arr.length && arr[0] < cutoff) arr.shift();
  });
};

const notify = () => {
  subscribers.forEach(fn => { fn(); });
};

export const recordModelCall = (model: string) => {
  let history = usageHistories[model];
  if (!history) {
    history = [];
    usageHistories[model] = history;
  }
  history.push(Date.now());
  purgeOld();
  notify();
};

export const getModelUsageCount = (model: string): number => {
  purgeOld();
  return usageHistories[model]?.length ?? 0;
};

export const subscribeToModelUsage = (fn: () => void): (() => void) => {
  subscribers.push(fn);
  return () => {
    subscribers = subscribers.filter(s => s !== fn);
  };
};

/**
 * Returns the delay in milliseconds required before issuing the next call to
 * the given model so as not to exceed the provided per-minute rate limit.
 */
export const getDelayUntilUnderLimit = (model: string, limit: number): number => {
  purgeOld();
  const history = usageHistories[model] ?? [];
  if (history.length < limit) return 0;
  const index = history.length - limit;
  const targetTime = history[index] + 60_000;
  return Math.max(0, targetTime - Date.now());
};
