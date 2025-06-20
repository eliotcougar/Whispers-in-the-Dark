let progressString = '';
const listeners: Array<(s: string) => void> = [];

const emit = () => {
  listeners.forEach(fn => { fn(progressString); });
};

export const onProgress = (fn: (s: string) => void): void => {
  listeners.push(fn);
  fn(progressString);
};

export const offProgress = (fn: (s: string) => void): void => {
  const idx = listeners.indexOf(fn);
  if (idx !== -1) listeners.splice(idx, 1);
};

export const addProgressSymbol = (sym: string): void => {
  progressString = sym + progressString;
  emit();
};

export const clearProgress = (): void => {
  progressString = '';
  emit();
};

export const getProgress = () => progressString;
