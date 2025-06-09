let progressString = '';
let subscribers: Array<(s: string) => void> = [];

export const subscribeToProgress = (fn: (s: string) => void): (() => void) => {
  subscribers.push(fn);
  fn(progressString);
  return () => {
    subscribers = subscribers.filter((s) => s !== fn);
  };
};

export const addProgressSymbol = (sym: string) => {
  progressString = sym + progressString;
  subscribers.forEach((fn) => fn(progressString));
};

export const clearProgress = () => {
  progressString = '';
  subscribers.forEach((fn) => fn(progressString));
};

export const getProgress = () => progressString;
