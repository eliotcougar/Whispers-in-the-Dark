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
  const match = /status:\s*(\d{3})/.exec(msg);
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

interface ErrorDetail {
  ['@type']?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const matchesApiKeyInvalidDetail = (detail: unknown): boolean => {
  if (!detail || typeof detail !== 'object') return false;
  const d = detail as ErrorDetail;
  if (d.reason === 'API_KEY_INVALID') return true;
  if (
    typeof d['@type'] === 'string' &&
    d['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
    d.reason === 'API_KEY_INVALID'
  ) {
    return true;
  }
  return false;
};

export const INVALID_API_KEY_USER_MESSAGE =
  'Gemini API key is invalid. Open the Title menu and choose "Change Gemini Key" to enter a new key.';

export class InvalidApiKeyError extends Error {
  constructor(message: string = INVALID_API_KEY_USER_MESSAGE) {
    super(message);
    this.name = 'InvalidApiKeyError';
  }
}

export const isInvalidApiKeyResponse = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const errObj = err as {
    error?: {
      status?: string;
      code?: number | string;
      message?: string;
      details?: Array<unknown>;
    };
    message?: string;
  };
  const status = errObj.error?.status ?? errObj.error?.code;
  if (typeof status === 'string' && status.toUpperCase() === 'API_KEY_INVALID') {
    return true;
  }
  const rawDetails = errObj.error?.details;
  const details = Array.isArray(rawDetails) ? rawDetails : [];
  const hasInvalidDetail = details.some(matchesApiKeyInvalidDetail);
  if (
    typeof status === 'string' &&
    status.toUpperCase() === 'INVALID_ARGUMENT' &&
    hasInvalidDetail
  ) {
    return true;
  }
  if (
    typeof status === 'number' &&
    status === 400 &&
    hasInvalidDetail
  ) {
    return true;
  }
  const msgCandidates = [errObj.error?.message, errObj.message];
  if (
    msgCandidates.some(
      msg => typeof msg === 'string' && msg.toLowerCase().includes('api key not valid'),
    )
  ) {
    return true;
  }
  return false;
};

export const isInvalidApiKeyError = (err: unknown): err is InvalidApiKeyError =>
  err instanceof InvalidApiKeyError || isInvalidApiKeyResponse(err);

export const toInvalidApiKeyError = (err: unknown): InvalidApiKeyError => {
  if (err instanceof InvalidApiKeyError) return err;
  const invalid = new InvalidApiKeyError();
  if (err instanceof Error && typeof err.stack === 'string') {
    invalid.stack = `${invalid.stack ?? ''}\nCaused by: ${err.stack}`;
  }
  return invalid;
};

/**
 * Determines if the error is likely transient (e.g. network hiccups).
 * Currently checks for common messages like net::ERR_SSL_PROTOCOL_ERROR.
 *
 * @param err - The caught error.
 * @returns True if the error message suggests a transient network failure.
 */
export const isTransientNetworkError = (err: unknown): boolean => {
  if (!err) return false;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string' ||
          typeof err === 'number' ||
          typeof err === 'boolean'
        ? String(err)
        : '';
  return (
    message.includes('ERR_SSL_PROTOCOL_ERROR') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EAI_AGAIN') ||
    message.includes('Failed to fetch')
  );
};
