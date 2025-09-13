/**
 * @file loadingProgress.ts
 * @description Tracks progress UI signals and retry counts for async operations.
 * Built on the shared observable helper in `utils/observable.ts`.
 */
import { createObservable } from './observable';

const progress = createObservable<string>('');
const retries = createObservable<number>(0);

export const onProgress = (fn: (s: string) => void): void => { progress.on(fn); };
export const offProgress = (fn: (s: string) => void): void => { progress.off(fn); };
export const getProgress = (): string => progress.get();
export const addProgressSymbol = (sym: string): void => { progress.set(sym + progress.get()); };
export const clearProgress = (): void => { progress.set(''); };

export const onRetryCount = (fn: (c: number) => void): void => { retries.on(fn); };
export const offRetryCount = (fn: (c: number) => void): void => { retries.off(fn); };
export const getRetryCount = (): number => retries.get();
export const incrementRetryCount = (): void => { retries.set(retries.get() + 1); };
export const clearRetryCount = (): void => { retries.set(0); };

