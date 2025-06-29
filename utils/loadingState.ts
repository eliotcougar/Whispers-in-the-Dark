import { LoadingReason } from '../types';

let currentReason: LoadingReason | null = null;
const listeners: Array<(r: LoadingReason | null) => void> = [];

const emit = () => {
  listeners.forEach(fn => {
    fn(currentReason);
  });
};

export const onLoadingReason = (fn: (r: LoadingReason | null) => void): void => {
  listeners.push(fn);
  fn(currentReason);
};

export const offLoadingReason = (fn: (r: LoadingReason | null) => void): void => {
  const idx = listeners.indexOf(fn);
  if (idx !== -1) listeners.splice(idx, 1);
};

export const setLoadingReason = (reason: LoadingReason | null): void => {
  currentReason = reason;
  emit();
};

export const getLoadingReason = (): LoadingReason | null => currentReason;
