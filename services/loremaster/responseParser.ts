/**
 * @file responseParser.ts
 * @description Parses Loremaster AI responses.
 */
import { LoreRefinementResult, ThemeFactChange, FactWithEntities } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';

const isThemeFactChange = (value: unknown): value is ThemeFactChange => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Partial<ThemeFactChange>;
  if (typeof obj.action !== 'string') return false;
  if (obj.fact) {
    const fact = obj.fact as Partial<ThemeFactChange['fact']> | undefined;
    if (
      fact?.entities !== undefined &&
      (!Array.isArray(fact.entities) || !fact.entities.every(id => typeof id === 'string'))
    ) {
      return false;
    }
  }
  return true;
};

export const parseExtractFactsResponse = (
  responseText: string,
): Array<FactWithEntities> | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!parsed) return null;
  if (
    Array.isArray(parsed) &&
    parsed.every(f => {
      if (!f || typeof f !== 'object') return false;
      const ent = (f as { entities?: unknown }).entities;
      return (
        typeof (f as { text?: unknown }).text === 'string' &&
        Array.isArray(ent) &&
        (ent as Array<unknown>).every((id: unknown): id is string => typeof id === 'string')
      );
    })
  ) {
    return parsed as Array<FactWithEntities>;
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
        if (raw.fact) {
          raw.fact.entities = Array.isArray(raw.fact.entities)
            ? raw.fact.entities.filter((id: unknown): id is string => typeof id === 'string')
            : [];
        }
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
