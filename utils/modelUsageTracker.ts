// Utility to track AI model usage within the last minute
import {
  GEMINI_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  MINIMAL_MODEL_NAME,
} from '../constants';

const usageHistories: Record<string, number[]> = {
  [GEMINI_MODEL_NAME]: [],
  [AUXILIARY_MODEL_NAME]: [],
  [MINIMAL_MODEL_NAME]: [],
};

let subscribers: Array<() => void> = [];

const purgeOld = () => {
  const cutoff = Date.now() - 60_000;
  Object.values(usageHistories).forEach(arr => {
    while (arr.length && arr[0] < cutoff) arr.shift();
  });
};

const notify = () => {
  subscribers.forEach(fn => fn());
};

export const recordModelCall = (model: string) => {
  if (!usageHistories[model]) {
    usageHistories[model] = [];
  }
  usageHistories[model].push(Date.now());
  purgeOld();
  notify();
};

export const getModelUsageCount = (model: string): number => {
  purgeOld();
  return usageHistories[model]?.length || 0;
};

export const subscribeToModelUsage = (fn: () => void): (() => void) => {
  subscribers.push(fn);
  return () => {
    subscribers = subscribers.filter(s => s !== fn);
  };
};
