/**
 * @file jsonUtils.ts
 * @description Small helpers for working with JSON strings.
 */

/**
 * Extracts JSON content from a possible fenced code block. Many of our AI
 * services wrap JSON in ```json fences. This helper strips those fences if
 * present and returns the inner JSON string.
 */
export const extractJsonFromFence = (raw: string): string => {
  let jsonStr = raw.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const match = fenceRegex.exec(jsonStr);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  return jsonStr;
};

/**
 * Attempts to parse the provided JSON string. Returns the parsed object
 * or `null` if parsing fails.
 */
export function safeParseJson<T>(jsonStr: string): T | null {
  try {
    return JSON.parse(jsonStr) as T;
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
