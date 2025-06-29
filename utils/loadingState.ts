import { LoadingReason } from '../types';

let currentReason: LoadingReason | null = null;
const listeners: Array<(val: LoadingReason | null) => void> = [];

export const setLoadingReason = (reason: LoadingReason | null): void => {
  currentReason = reason;
  listeners.forEach(fn => {
    fn(currentReason);
  });
};

export const onLoadingReason = (fn: (val: LoadingReason | null) => void): void => {
  listeners.push(fn);
  fn(currentReason);
};

export const offLoadingReason = (fn: (val: LoadingReason | null) => void): void => {
  const idx = listeners.indexOf(fn);
  if (idx !== -1) listeners.splice(idx, 1);
};

export const getLoadingReason = (): LoadingReason | null => currentReason;
