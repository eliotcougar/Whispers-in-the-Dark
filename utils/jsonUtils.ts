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
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
  }
  return jsonStr;
};
