/**
 * @file loadingState.ts
 * @description Global loading reason pub-sub for UI. Uses `utils/observable.ts`.
 */
import { LoadingReason } from '../types';
import { createObservable } from './observable';

const reason = createObservable<LoadingReason | null>(null);

export const setLoadingReason = (val: LoadingReason | null): void => {
  if (val === null) {
    setTimeout(() => { reason.set(null); }, 0);
  } else {
    reason.set(val);
  }
};

export const onLoadingReason = (fn: (val: LoadingReason | null) => void): void => { reason.on(fn); };
export const offLoadingReason = (fn: (val: LoadingReason | null) => void): void => { reason.off(fn); };
export const getLoadingReason = (): LoadingReason | null => reason.get();
