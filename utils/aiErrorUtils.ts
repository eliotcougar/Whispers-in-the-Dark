/**
 * @file aiErrorUtils.ts
 * @description Helper utilities for interpreting errors from Gemini API calls.
 */

/**
 * Attempts to extract an HTTP status code from an error object thrown by
 * the Gemini client.
 *
 * @param err - The caught error.
 * @returns The numeric status code or null if none was found.
 */
export const extractStatusFromError = (err: unknown): number | null => {
  if (!err || typeof err !== 'object') return null;
  const errObj = err as {
    status?: number;
    error?: { code?: number };
    message?: unknown;
  };
  if (typeof errObj.status === 'number') return errObj.status;
  if (errObj.error && typeof errObj.error.code === 'number') return errObj.error.code;
  const msg =
    typeof errObj.message === 'string' ||
    typeof errObj.message === 'number' ||
    typeof errObj.message === 'boolean'
      ? String(errObj.message)
      : '';
  const match = msg.match(/status:\s*(\d{3})/);
  if (match) return parseInt(match[1], 10);
  return null;
};

/**
 * Determines if the provided error represents a client or server HTTP failure.
 * Useful for short-circuiting retries when the model is overloaded or the
 * request is invalid.
 *
 * @param err - The caught error.
 * @returns True if the error is a 4xx or 5xx HTTP error.
 */
export const isServerOrClientError = (err: unknown): boolean => {
  const status = extractStatusFromError(err);
  return status !== null && status >= 400 && status < 600;
};
