/**
 * @file responseParser.ts
 * @description Parses Loremaster AI responses.
 */
import { LoreRefinementResult, ThemeFactChange } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';

const isThemeFactChange = (value: unknown): value is ThemeFactChange => {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { action?: unknown }).action === 'string'
  );
};

export const parseExtractFactsResponse = (
  responseText: string,
): Array<string> | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!parsed) return null;
  if (Array.isArray(parsed) && parsed.every(f => typeof f === 'string')) {
    return parsed;
  }
  return null;
};

export const parseIntegrationResponse = (
  responseText: string,
  existingFacts: Array<{ id: number }> = [],
): LoreRefinementResult | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Partial<LoreRefinementResult> & { factsChange?: unknown };
  const factsArr: Array<ThemeFactChange> = [];
  const validIds = existingFacts.map(f => f.id);
  if (Array.isArray(obj.factsChange)) {
    obj.factsChange.forEach(raw => {
      if (isThemeFactChange(raw)) {
        factsArr.push(raw);
      }
    });
  }
  if (
    factsArr.some(
      fc =>
        (fc.action === 'change' || fc.action === 'delete') &&
        (typeof fc.id !== 'number' || !validIds.includes(fc.id)),
    )
  ) {
    return null;
  }
  const outcome = typeof obj.loreRefinementOutcome === 'string'
    ? obj.loreRefinementOutcome
    : '';
  const observations = typeof obj.observations === 'string' ? obj.observations : undefined;
  const rationale = typeof obj.rationale === 'string' ? obj.rationale : undefined;
  return { factsChange: factsArr, loreRefinementOutcome: outcome, observations, rationale };
};

export const parseCollectFactsResponse = (
  responseText: string,
): Array<string> | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!parsed) return null;
  if (Array.isArray(parsed) && parsed.every(f => typeof f === 'string')) {
    return parsed;
  }
  return null;
};
