export interface RetryResult<T> {
  result: T | null;
  /** Return false to stop retrying even if result is null */
  retry?: boolean;
}

import { MAX_RETRIES } from '../constants';
import { isServerOrClientError, isTransientNetworkError } from './aiErrorUtils';
import { incrementRetryCount, clearRetryCount } from './loadingProgress';

/**
 * Retries an async AI operation up to MAX_RETRIES times.
 * The callback receives the current attempt number starting at 0 and should
 * return a { result, retry } object. If `result` is non-null it is returned
 * immediately. If `retry` is `false`, the retries stop regardless of result.
 * API errors (HTTP 4xx/5xx) are automatically retried, other errors are thrown.
 */
export const retryAiCall = async <T>(
  callback: (attempt: number) => Promise<RetryResult<T>>,
  delayMs = 500,
): Promise<T | null> => {
  clearRetryCount();
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let transient = false;
    try {
      const { result, retry = true } = await callback(attempt);
      if (result !== null) return result;
      if (!retry) return null;
    } catch (error: unknown) {
      transient = isTransientNetworkError(error);
      if (!isServerOrClientError(error) && !transient) throw error;
    }
    if (attempt < MAX_RETRIES) {
      incrementRetryCount();
      const wait = transient ? Math.max(delayMs, 5000) : delayMs;
      await new Promise(res => setTimeout(res, wait));
    }
  }
  clearRetryCount();
  return null;
};
