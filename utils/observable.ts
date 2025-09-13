/**
 * @file observable.ts
 * @description Minimal observable helper to manage value + subscribers.
 */

export interface Observable<T> {
  get(): T;
  set(value: T): void;
  on(fn: (value: T) => void): void;
  off(fn: (value: T) => void): void;
  emit(): void;
}

/**
 * Creates a simple observable value with subscribe/emit helpers.
 * Subscriptions receive the current value immediately upon registration.
 */
export const createObservable = <T>(initial: T): Observable<T> => {
  let value = initial;
  const listeners: Array<(v: T) => void> = [];

  const emit = () => {
    // clone to prevent mutation during iteration
    [...listeners].forEach(fn => {
      try { fn(value); } catch { /* ignore subscriber errors */ }
    });
  };

  return {
    get: () => value,
    set: (v: T) => { value = v; emit(); },
    on: (fn: (v: T) => void) => { listeners.push(fn); fn(value); },
    off: (fn: (v: T) => void) => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    },
    emit,
  };
};

