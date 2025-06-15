/**
 * @file responseParser.ts
 * @description Parsing helpers for cartographer AI responses.
 */
import {
  AIMapUpdatePayload,
  MapNodeData,
  MapEdgeData,
} from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidAIMapUpdatePayload } from '../../utils/mapUpdateValidationUtils';
import {
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
} from '../../constants';
import {
  NODE_STATUS_SYNONYMS,
  NODE_TYPE_SYNONYMS,
  EDGE_TYPE_SYNONYMS,
  EDGE_STATUS_SYNONYMS,
} from '../../utils/mapSynonyms';

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
 * Normalizes status and type fields within the payload to their canonical
 * values, accepting various synonyms. Returns an array of errors for any
 * values that remain invalid after synonym normalization.
 */
const normalizeStatusAndTypeSynonyms = (payload: AIMapUpdatePayload): string[] => {
  const errors: string[] = [];

  const nodeStatusSynonyms = NODE_STATUS_SYNONYMS;
  const nodeTypeSynonyms = NODE_TYPE_SYNONYMS;
  const edgeTypeSynonyms = EDGE_TYPE_SYNONYMS;
  const edgeStatusSynonyms = EDGE_STATUS_SYNONYMS;

  const applyNodeDataFix = (data: Partial<MapNodeData> | undefined, context: string) => {
    if (!data) return;
    if (data.status) {
      const mapped = nodeStatusSynonyms[data.status.toLowerCase()];
      if (mapped) data.status = mapped;
      if (!VALID_NODE_STATUS_VALUES.includes(data.status)) {
        errors.push(`${context} invalid status "${data.status}"`);
      }
    }
    if (data.nodeType) {
      const mapped = nodeTypeSynonyms[data.nodeType.toLowerCase()];
      if (mapped) data.nodeType = mapped;
      if (!VALID_NODE_TYPE_VALUES.includes(data.nodeType)) {
        errors.push(`${context} invalid nodeType "${data.nodeType}"`);
      }
    }
  };

  const applyEdgeDataFix = (data: Partial<MapEdgeData> | undefined, context: string) => {
    if (!data) return;
    if (data.type) {
      const mapped = edgeTypeSynonyms[data.type.toLowerCase()];
      if (mapped) data.type = mapped;
      if (!VALID_EDGE_TYPE_VALUES.includes(data.type)) {
        errors.push(`${context} invalid type "${data.type}"`);
      }
    }
    if (data.status) {
      const mapped = edgeStatusSynonyms[data.status.toLowerCase()];
      if (mapped) data.status = mapped;
      if (!VALID_EDGE_STATUS_VALUES.includes(data.status)) {
        errors.push(`${context} invalid status "${data.status}"`);
      }
    }
  };

  (payload.nodesToAdd || []).forEach((n, idx) => applyNodeDataFix(n.data, `nodesToAdd[${idx}]`));
  (payload.nodesToUpdate || []).forEach((n, idx) => applyNodeDataFix(n.newData, `nodesToUpdate[${idx}].newData`));
  (payload.edgesToAdd || []).forEach((e, idx) => applyEdgeDataFix(e.data, `edgesToAdd[${idx}]`));
  (payload.edgesToUpdate || []).forEach((e, idx) => applyEdgeDataFix(e.newData, `edgesToUpdate[${idx}].newData`));
  (payload.edgesToRemove || []).forEach((e, idx) => {
    if (e.type) {
      const mapped = edgeTypeSynonyms[e.type.toLowerCase()];
      if (mapped) e.type = mapped;
      if (!VALID_EDGE_TYPE_VALUES.includes(e.type)) {
        errors.push(`edgesToRemove[${idx}] invalid type "${e.type}"`);
      }
    }
  });

  if (payload.splitFamily && payload.splitFamily.newNodeType) {
    const mapped = nodeTypeSynonyms[payload.splitFamily.newNodeType.toLowerCase()];
    if (mapped) payload.splitFamily.newNodeType = mapped;
    if (!VALID_NODE_TYPE_VALUES.includes(payload.splitFamily.newNodeType)) {
      errors.push(`splitFamily.newNodeType invalid "${payload.splitFamily.newNodeType}"`);
    }
  }

  return errors;
};

/**
 * Parses the AI's map update response into an AIMapUpdatePayload structure.
 */
export const parseAIMapUpdateResponse = (
  responseText: string,
): AIMapUpdatePayload | null => {
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
              ...(acc.nodesToAdd || []),
              ...maybeObj.nodesToAdd,
            ];
          }
          if (Array.isArray(maybeObj.nodesToUpdate)) {
            acc.nodesToUpdate = [
              ...(acc.nodesToUpdate || []),
              ...maybeObj.nodesToUpdate,
            ];
          }
          if (Array.isArray(maybeObj.nodesToRemove)) {
            acc.nodesToRemove = [
              ...(acc.nodesToRemove || []),
              ...maybeObj.nodesToRemove,
            ];
          }
          if (Array.isArray(maybeObj.edgesToAdd)) {
            acc.edgesToAdd = [
              ...(acc.edgesToAdd || []),
              ...maybeObj.edgesToAdd,
            ];
          }
          if (Array.isArray(maybeObj.edgesToUpdate)) {
            acc.edgesToUpdate = [
              ...(acc.edgesToUpdate || []),
              ...maybeObj.edgesToUpdate,
            ];
          }
          if (Array.isArray(maybeObj.edgesToRemove)) {
            acc.edgesToRemove = [
              ...(acc.edgesToRemove || []),
              ...maybeObj.edgesToRemove,
            ];
          }
          if (
            maybeObj.suggestedCurrentMapNodeId &&
            !acc.suggestedCurrentMapNodeId
          ) {
            acc.suggestedCurrentMapNodeId = maybeObj.suggestedCurrentMapNodeId;
          }
          if (maybeObj.splitFamily && !acc.splitFamily) {
            acc.splitFamily = maybeObj.splitFamily;
          }
          if (maybeObj.observations && !acc.observations) {
            acc.observations = maybeObj.observations;
          }
          if (maybeObj.rationale && !acc.rationale) {
            acc.rationale = maybeObj.rationale;
          }
        }
        return acc;
      }, {} as AIMapUpdatePayload);
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
        payload.nodesToRemove = payload.nodesToRemove.filter(n => !nameIsUniverse(n.placeName));
      }
      const filterEdgeArray = <T extends { sourcePlaceName: string; targetPlaceName: string }>(
        arr: T[] | undefined,
      ): T[] =>
        (arr || []).filter(
          e => !nameIsUniverse(e.sourcePlaceName) && !nameIsUniverse(e.targetPlaceName),
        );
      if (Array.isArray(payload.edgesToAdd)) {
        payload.edgesToAdd = filterEdgeArray(payload.edgesToAdd);
      }
      if (Array.isArray(payload.edgesToUpdate)) {
        payload.edgesToUpdate = filterEdgeArray(payload.edgesToUpdate);
      }
      if (Array.isArray(payload.edgesToRemove)) {
        payload.edgesToRemove = filterEdgeArray(payload.edgesToRemove);
      }

      // Normalize any synonym values before validation so parsing succeeds
      normalizeStatusAndTypeSynonyms(payload);
    }
    if (isValidAIMapUpdatePayload(payload)) {
      return payload;
    }
    console.warn('Parsed map update JSON does not match AIMapUpdatePayload structure or is empty:', parsed);
    return null;
  } catch (e) {
    console.error('Failed to parse map update JSON response from AI:', e);
    console.debug('Original map update response text:', responseText);
    return null;
  }
};
