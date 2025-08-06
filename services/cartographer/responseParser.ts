/**
 * @file responseParser.ts
 * @description Parsing helpers for cartographer AI responses.
 */
import { AIMapUpdatePayload, AdventureTheme } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidAIMapUpdatePayload } from '../../utils/mapUpdateValidation';
import { normalizeStatusAndTypeSynonyms } from '../../utils/mapUpdateUtils';
import { fetchCorrectedMapUpdatePayload_Service } from '../corrections';

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


/**
 * Parses the AI's map update response into an AIMapUpdatePayload structure.
 */
export interface ParsedMapUpdateResult {
  payload: AIMapUpdatePayload | null;
  validationError?: string;
}

export const parseAIMapUpdateResponse = async (
  responseText: string,
  currentTheme: AdventureTheme,
): Promise<ParsedMapUpdateResult> => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed: unknown = safeParseJson(jsonStr);
  try {
    if (parsed === null) throw new Error('JSON parse failed');
    let payload: AIMapUpdatePayload | null = null;
    if (Array.isArray(parsed)) {
      payload = parsed.reduce<AIMapUpdatePayload>((acc, entry) => {
        if (entry && typeof entry === 'object') {
          const maybeObj = entry as Partial<AIMapUpdatePayload>;
          if (Array.isArray(maybeObj.nodesToAdd)) {
            acc.nodesToAdd = [
              ...(acc.nodesToAdd ?? []),
              ...maybeObj.nodesToAdd,
            ];
          }
          if (Array.isArray(maybeObj.nodesToUpdate)) {
            acc.nodesToUpdate = [
              ...(acc.nodesToUpdate ?? []),
              ...maybeObj.nodesToUpdate,
            ];
          }
          if (Array.isArray(maybeObj.nodesToRemove)) {
            acc.nodesToRemove = [
              ...(acc.nodesToRemove ?? []),
              ...maybeObj.nodesToRemove,
            ];
          }
          if (Array.isArray(maybeObj.edgesToAdd)) {
            acc.edgesToAdd = [
              ...(acc.edgesToAdd ?? []),
              ...maybeObj.edgesToAdd,
            ];
          }
          if (Array.isArray(maybeObj.edgesToUpdate)) {
            acc.edgesToUpdate = [
              ...(acc.edgesToUpdate ?? []),
              ...maybeObj.edgesToUpdate,
            ];
          }
          if (Array.isArray(maybeObj.edgesToRemove)) {
            acc.edgesToRemove = [
              ...(acc.edgesToRemove ?? []),
              ...maybeObj.edgesToRemove,
            ];
          }
          if (
            maybeObj.suggestedCurrentMapNodeId &&
            !acc.suggestedCurrentMapNodeId
          ) {
            acc.suggestedCurrentMapNodeId = maybeObj.suggestedCurrentMapNodeId;
          }
          if (maybeObj.observations && !acc.observations) {
            acc.observations = maybeObj.observations;
          }
          if (maybeObj.rationale && !acc.rationale) {
            acc.rationale = maybeObj.rationale;
          }
        }
        return acc;
      }, {});
    } else if (parsed && typeof parsed === 'object') {
      payload = parsed as AIMapUpdatePayload;
    }
    // Drop any illegal attempts to reference the root node "Universe" before validation.
    if (payload && typeof payload === 'object') {
      const nameIsUniverse = (n: unknown): boolean =>
        typeof n === 'string' && n.trim().toLowerCase() === 'universe';
      if (Array.isArray(payload.nodesToAdd)) {
        payload.nodesToAdd = payload.nodesToAdd.filter(n => !nameIsUniverse(n.placeName));
      }
      if (Array.isArray(payload.nodesToUpdate)) {
        payload.nodesToUpdate = payload.nodesToUpdate.filter(n => !nameIsUniverse(n.placeName));
      }
      if (Array.isArray(payload.nodesToRemove)) {
        payload.nodesToRemove = payload.nodesToRemove.filter(n => !nameIsUniverse(n.nodeName));
      }
      const filterEdgeArray = <T extends { sourcePlaceName: string; targetPlaceName: string }>(
        arr: Array<T> | undefined,
      ): Array<T> =>
        (arr ?? []).filter(
          e => !nameIsUniverse(e.sourcePlaceName) && !nameIsUniverse(e.targetPlaceName),
        );
      if (Array.isArray(payload.edgesToAdd)) {
        payload.edgesToAdd = filterEdgeArray(payload.edgesToAdd);
      }
      if (Array.isArray(payload.edgesToUpdate)) {
        payload.edgesToUpdate = filterEdgeArray(payload.edgesToUpdate);
      }
      if (Array.isArray(payload.edgesToRemove)) {
        // edgesToRemove now uses IDs; no Universe filtering needed
      }

      // Normalize any synonym values before validation so parsing succeeds
      normalizeStatusAndTypeSynonyms(payload);
    }
    let validationError: string | undefined;
    if (payload) {
      const warnings: Array<string> = [];
      const originalWarn = console.warn;
      console.warn = (...args: Array<unknown>) => {
        warnings.push(args.map(a => String(a)).join(' '));
        originalWarn(...args);
      };
      const valid = isValidAIMapUpdatePayload(payload);
      console.warn = originalWarn;
      if (valid) {
        return { payload };
      }
      validationError = warnings.length > 0 ? warnings.join('; ') : undefined;
    }
    console.warn(
      'Parsed map update JSON does not match AIMapUpdatePayload structure or is empty:',
      parsed,
    );
    const corrected = await fetchCorrectedMapUpdatePayload_Service(
      jsonStr,
      validationError,
      currentTheme,
    );
    if (corrected) {
      return { payload: corrected };
    }
    return { payload: null, validationError };
  } catch (e: unknown) {
    console.error('Failed to parse map update JSON response from AI:', e);
    console.debug('Original map update response text:', responseText);
    const corrected = await fetchCorrectedMapUpdatePayload_Service(
      jsonStr,
      e instanceof Error ? e.message : String(e),
      currentTheme,
    );
    if (corrected) {
      return { payload: corrected };
    }
    return { payload: null, validationError: e instanceof Error ? e.message : String(e) };
  }
};
