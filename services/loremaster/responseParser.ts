/**
 * @file responseParser.ts
 * @description Parses Loremaster AI responses.
 */
import { LoreRefinementResult, LoreFactChange, FactWithEntities } from '../../types';
import { safeParseJson } from '../../utils/jsonUtils';

const isLoreFactChange = (value: unknown): value is LoreFactChange => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Partial<LoreFactChange>;
  if (typeof obj.action !== 'string') return false;
  if (
    obj.entities !== undefined &&
    (!Array.isArray(obj.entities) || !obj.entities.every(id => typeof id === 'string'))
  ) {
    return false;
  }
  if (obj.text !== undefined && typeof obj.text !== 'string') return false;
  return true;
};

export const parseExtractFactsResponse = (
  responseText: string,
): Array<FactWithEntities> | null => {
  const parsed = safeParseJson<unknown>(responseText);
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
  const parsed = safeParseJson<unknown>(responseText);
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Partial<LoreRefinementResult> & { factsChange?: unknown };
  const factsArr: Array<LoreFactChange> = [];
  const validIds = existingFacts.map(f => f.id);
  if (Array.isArray(obj.factsChange)) {
    obj.factsChange.forEach(raw => {
      if (isLoreFactChange(raw)) {
        if (Array.isArray(raw.entities)) {
          raw.entities = raw.entities.filter(
            (id: unknown): id is string => typeof id === 'string',
          );
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
  const parsed = safeParseJson<unknown>(responseText);
  if (!parsed) return null;
  if (Array.isArray(parsed) && parsed.every(f => typeof f === 'string')) {
    return parsed;
  }
  return null;
};
