/**
 * @file responseParser.ts
 * @description Parsing helpers for cartographer AI responses.
 */
import { AIMapUpdatePayload } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidAIMapUpdatePayload } from '../../utils/mapUpdateValidationUtils';

/**
 * Attempts to parse the AI response text into an AIMapUpdatePayload.
 */
export const parseCartographerResponse = (
  responseText: string,
): AIMapUpdatePayload | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<AIMapUpdatePayload>(jsonStr);
  return isValidAIMapUpdatePayload(parsed) ? parsed : null;
};
