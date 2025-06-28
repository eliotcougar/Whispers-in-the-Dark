let progressString = '';
const listeners: Array<(s: string) => void> = [];
let retryCount = 0;
const retryListeners: Array<(c: number) => void> = [];

const emitRetry = () => {
  retryListeners.forEach(fn => {
    fn(retryCount);
  });
};

const emit = () => {
  listeners.forEach(fn => { fn(progressString); });
};

export const onProgress = (fn: (s: string) => void): void => {
  listeners.push(fn);
  fn(progressString);
};

export const onRetryCount = (fn: (c: number) => void): void => {
  retryListeners.push(fn);
  fn(retryCount);
};

export const offProgress = (fn: (s: string) => void): void => {
  const idx = listeners.indexOf(fn);
  if (idx !== -1) listeners.splice(idx, 1);
};

export const offRetryCount = (fn: (c: number) => void): void => {
  const idx = retryListeners.indexOf(fn);
  if (idx !== -1) retryListeners.splice(idx, 1);
};

export const addProgressSymbol = (sym: string): void => {
  progressString = sym + progressString;
  emit();
};

export const incrementRetryCount = (): void => {
  retryCount += 1;
  emitRetry();
};

export const clearProgress = (): void => {
  progressString = '';
  emit();
};

export const clearRetryCount = (): void => {
  retryCount = 0;
  emitRetry();
};

export const getProgress = () => progressString;

export const getRetryCount = () => retryCount;

