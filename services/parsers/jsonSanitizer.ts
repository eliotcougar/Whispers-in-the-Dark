/**
 * @file jsonSanitizer.ts
 * @description Helper for cleaning raw AI responses into valid JSON strings.
 */

/**
 * Strips Markdown fences and trims whitespace from a potential JSON string.
 *
 * @param rawText - The raw string returned from the AI model.
 * @returns The cleaned JSON string ready for parsing.
 */
export function sanitizeJsonString(rawText: string): string {
  let jsonStr = rawText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }
  return jsonStr;
}
