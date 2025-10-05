/**
 * @file responseParser.ts
 * @description Parsing helpers for cartographer AI responses.
 */
import { AIMapUpdatePayload, AdventureTheme } from '../../types';
import { safeParseJson } from '../../utils/jsonUtils';
import { isValidAIMapUpdatePayload } from './mapUpdateValidation';
import { normalizeStatusAndTypeSynonyms } from './mapUpdateUtils';
import { fetchCorrectedMapUpdatePayload } from '../corrections';
import { ROOT_MAP_NODE_ID } from '../../constants';

/**
 * Attempts to parse the AI response text into an AIMapUpdatePayload.
 */
export const parseCartographerResponse = (
  responseText: string,
): AIMapUpdatePayload | null => {
  const parsed = safeParseJson<AIMapUpdatePayload>(responseText);
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
  theme: AdventureTheme,
): Promise<ParsedMapUpdateResult> => {
  const defaultValidationError =
    'Map update response must include valid nodes/edges formatted according to the documented schema.';
  const parsed: unknown = safeParseJson(responseText);
  try {
    if (parsed === null) throw new Error('JSON parse failed');
    let payload: AIMapUpdatePayload | null = null;
    if (Array.isArray(parsed)) {
      payload = parsed.reduce<AIMapUpdatePayload>((acc, entry) => {
        if (entry && typeof entry === 'object') {
          const maybeObj = entry as Partial<AIMapUpdatePayload>;
          // Recognize navigation-only schema fragments: { nodeAndEdge: { nodeToAdd, edgeToAdd }, suggestedCurrentMapNodeId }
          const maybeNav: unknown = (maybeObj as unknown as Record<string, unknown>)['nodeAndEdge'];
          if (maybeNav && typeof maybeNav === 'object') {
            const navObj = maybeNav as Record<string, unknown>;
            if (navObj.edgeToAdd && typeof navObj.edgeToAdd === 'object') {
              acc.edgesToAdd = [
                ...(acc.edgesToAdd ?? []),
                navObj.edgeToAdd as NonNullable<AIMapUpdatePayload['edgesToAdd']>[number],
              ];
            }
            if (navObj.nodeToAdd && typeof navObj.nodeToAdd === 'object') {
              acc.nodesToAdd = [
                ...(acc.nodesToAdd ?? []),
                navObj.nodeToAdd as NonNullable<AIMapUpdatePayload['nodesToAdd']>[number],
              ];
            }
          }
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
      // If the object matches navigation-only schema, convert it to full payload shape
      const asObj = parsed as Record<string, unknown>;
      if (asObj.nodeAndEdge && typeof asObj.nodeAndEdge === 'object') {
        const nav = asObj.nodeAndEdge as Record<string, unknown>;
        const converted: AIMapUpdatePayload = {};
        if (asObj.suggestedCurrentMapNodeId && typeof asObj.suggestedCurrentMapNodeId === 'string') {
          converted.suggestedCurrentMapNodeId = asObj.suggestedCurrentMapNodeId as string;
        }
        if (nav.nodeToAdd && typeof nav.nodeToAdd === 'object') {
          converted.nodesToAdd = [
            nav.nodeToAdd as NonNullable<AIMapUpdatePayload['nodesToAdd']>[number],
          ];
        }
        if (nav.edgeToAdd && typeof nav.edgeToAdd === 'object') {
          converted.edgesToAdd = [
            nav.edgeToAdd as NonNullable<AIMapUpdatePayload['edgesToAdd']>[number],
          ];
        }
        payload = converted;
      } else {
        payload = parsed as AIMapUpdatePayload;
      }
    }
    // Drop any illegal attempts to reference the root node before validation.
    if (payload && typeof payload === 'object') {
      const nodeIsRoot = (n: unknown): boolean =>
        typeof n === 'string' && n.trim().toLowerCase() === ROOT_MAP_NODE_ID;
      if (Array.isArray(payload.nodesToAdd)) {
        payload.nodesToAdd = payload.nodesToAdd.filter(n => !nodeIsRoot(n.placeName));
      }
      if (Array.isArray(payload.nodesToUpdate)) {
        payload.nodesToUpdate = payload.nodesToUpdate.filter(n => !nodeIsRoot(n.placeName));
      }
      if (Array.isArray(payload.nodesToRemove)) {
        payload.nodesToRemove = payload.nodesToRemove.filter(n => !nodeIsRoot(n.nodeName));
      }
      const filterEdgeArray = <T extends { sourcePlaceName: string; targetPlaceName: string }>(
        arr: Array<T> | undefined,
      ): Array<T> =>
        (arr ?? []).filter(
          e => !nodeIsRoot(e.sourcePlaceName) && !nodeIsRoot(e.targetPlaceName),
        );
      if (Array.isArray(payload.edgesToAdd)) {
        payload.edgesToAdd = filterEdgeArray(payload.edgesToAdd);
      }
      if (Array.isArray(payload.edgesToUpdate)) {
        payload.edgesToUpdate = filterEdgeArray(payload.edgesToUpdate);
      }
      if (Array.isArray(payload.edgesToRemove)) {
        // edgesToRemove now uses IDs; no root-name filtering needed
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
      validationError = warnings.length > 0 ? warnings.join('; ') : defaultValidationError;
    }
    console.warn(
      'Parsed map update JSON does not match AIMapUpdatePayload structure or is empty:',
      parsed,
    );
    const corrected = await fetchCorrectedMapUpdatePayload(
      responseText,
      validationError,
      theme,
    );
    if (corrected) {
      return { payload: corrected };
    }
    return { payload: null, validationError: validationError ?? defaultValidationError };
  } catch (e: unknown) {
    console.error('Failed to parse map update JSON response from AI:', e);
    console.debug('Original map update response text:', responseText);
    const corrected = await fetchCorrectedMapUpdatePayload(
      responseText,
      e instanceof Error ? e.message : String(e),
      theme,
    );
    if (corrected) {
      return { payload: corrected };
    }
    const errorMessage = e instanceof Error ? e.message : String(e);
    return {
      payload: null,
      validationError: errorMessage && errorMessage.trim().length > 0
        ? errorMessage
        : defaultValidationError,
    };
  }
};
