/**
 * @file services/corrections/hierarchyUpgrade.ts
 * @description Helpers for resolving map hierarchy issues.
 */

import { AdventureTheme, MapNode, MinimalModelCallRecord } from '../../types';
import {
  MAX_RETRIES,
  MINIMAL_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../apiClient';

export const decideFeatureHierarchyUpgrade_Service = async (
  parentFeature: MapNode,
  childNode: MapNode,
  currentTheme: AdventureTheme,
  debugLog?: Array<MinimalModelCallRecord>,
): Promise<'convert_child' | 'upgrade_parent' | null> => {
  if (!isApiConfigured()) {
    console.error('decideFeatureHierarchyUpgrade_Service: API Key not configured.');
    return null;
  }

  const prompt = `A feature node has acquired a child which violates the map hierarchy rules.
Parent Feature: "${parentFeature.placeName}" (Desc: "${parentFeature.data.description}")
Child Node: "${childNode.placeName}" (Type: ${childNode.data.nodeType})
Choose the best fix: "convert_child" to make the child a sibling, or "upgrade_parent" to upgrade the parent to a higher-level node.`;

  const systemInstruction = 'Respond only with convert_child or upgrade_parent.';

  return retryAiCall<'convert_child' | 'upgrade_parent'>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
        debugLog,
      });
      const resp = response.text?.trim() ?? null;
      if (resp) {
        const cleaned = resp.trim().toLowerCase();
        if (cleaned.includes('upgrade')) return { result: 'upgrade_parent' };
        if (cleaned.includes('convert') || cleaned.includes('sibling')) return { result: 'convert_child' };
      }
    } catch (error: unknown) {
      console.error(`decideFeatureHierarchyUpgrade_Service error (Attempt ${String(attempt + 1)}/$${String(MAX_RETRIES + 1)}):`, error);
      throw error;
    }
    return { result: null };
  });
};

export const resolveSplitFamilyOrphans_Service = async (
  context: {
    sceneDescription: string;
    logMessage: string | undefined;
    originalParent: MapNode;
    newParent: MapNode;
    orphanNodes: Array<MapNode>;
    currentTheme: AdventureTheme;
  },
): Promise<{ originalChildren: Array<string>; newChildren: Array<string> }> => {
  if (!isApiConfigured() || context.orphanNodes.length === 0)
    return { originalChildren: [], newChildren: [] };

  const orphanList = context.orphanNodes
    .map(o => `{"name":"${o.placeName}","id":"${o.id}"},"description":"${o.data.description || 'No description'}"}`)
    .join(', \n');

  const prompt = `Resolve orphan child nodes after splitting a parent location into two.
Original Parent: "${context.originalParent.placeName}" (ID:${context.originalParent.id})
New Parent: "${context.newParent.placeName}" (ID:${context.newParent.id})
Orphan Children: [${orphanList}]
Return JSON {"originalChildren": ["ids"], "newChildren": ["ids"]}`;

  const systemInstruction = 'Assign orphan nodes to either the original or new parent. Respond only with JSON.';

  const result = await retryAiCall<{ originalChildren: Array<string>; newChildren: Array<string> }>(async () => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const payload = safeParseJson<{ originalChildren: Array<string>; newChildren: Array<string> }>(extractJsonFromFence(response.text ?? ''));
      if (
        payload &&
        Array.isArray(payload.originalChildren) &&
        payload.originalChildren.every(id => typeof id === 'string') &&
        Array.isArray(payload.newChildren) &&
        payload.newChildren.every(id => typeof id === 'string')
      ) {
        return { result: payload };
      }
    } catch (e: unknown) {
      console.error('resolveSplitFamilyOrphans_Service error:', e);
      throw e;
    }
    return { result: null };
  });

  return result ?? { originalChildren: [], newChildren: [] };
};

