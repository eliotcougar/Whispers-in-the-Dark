/**
 * @file jsonUtils.ts
 * @description Small helpers for working with JSON strings.
 */

import { CODE_FENCE } from '../constants';

const fenceRegex = new RegExp(String.raw`^${CODE_FENCE}(?:json)?\s*\n?(.*?)\n?\s*${CODE_FENCE}$`, 's');

/**
 * Extracts JSON content from a possible fenced code block. Many of our AI
 * services wrap JSON in ```json fences. This helper strips those fences if
 * present and returns the inner JSON string.
 */
export const extractJsonFromFence = (raw: string): string => {
  let jsonStr = raw.trim();
  const match = fenceRegex.exec(jsonStr);
  if (match?.[1]) {
    jsonStr = match[1].trim();
  }
  return jsonStr;
};

/**
 * Attempts to parse the provided text into JSON. By default, it first strips a
 * ```json ... ``` fenced block if present, then parses. Returns the parsed
 * object or `null` if parsing (or optional validation) fails.
 */
export function safeParseJson<T>(
  raw: string,
  validate?: (data: unknown) => data is T,
): T | null {
  try {
    const jsonCandidate = extractJsonFromFence(raw);
    const parsed = JSON.parse(jsonCandidate) as unknown;
    if (validate && !validate(parsed)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Returns a shallow copy of the input object where any `null` values are
 * converted to `undefined`. Useful for sanitizing optional fields in AI
 * responses so they can be handled uniformly.
 */
export function coerceNullToUndefined<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v]),
  );
  return sanitized as T;
}

// Backwards compatibility for old imports
export const sanitizeJsonString = extractJsonFromFence;
