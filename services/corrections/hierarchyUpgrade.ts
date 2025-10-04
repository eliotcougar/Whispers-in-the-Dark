/**
 * @file services/corrections/hierarchyUpgrade.ts
 * @description Helpers for resolving map hierarchy issues.
 */

import { MapNode, MinimalModelCallRecord } from '../../types';
import {
  MAX_RETRIES,
  MINIMAL_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';

import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../geminiClient';

export const decideFeatureHierarchyUpgrade_Service = async (
  parentFeature: MapNode,
  childNode: MapNode,
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
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
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


export const chooseHierarchyResolution_Service = async (
  context: {
    sceneDescription: string;
    parent: MapNode;
    child: MapNode;
    options: Array<string>;
  },
  debugLog?: Array<MinimalModelCallRecord>,
): Promise<number | null> => {
  if (!isApiConfigured()) {
    console.error('chooseHierarchyResolution_Service: API Key not configured.');
    return null;
  }

  const optionsText = context.options
    .map((opt, idx) => `${String(idx + 1)}. ${opt}`)
    .join('\n');
  const prompt = `Scene: ${context.sceneDescription}\nParent: "${context.parent.placeName}" (${context.parent.data.nodeType}) - ${context.parent.data.description}\nChild: "${context.child.placeName}" (${context.child.data.nodeType}) - ${context.child.data.description}\nChoose the most sensible resolution for their hierarchy conflict:\n${optionsText}\nRespond ONLY with the option number.`;

  const systemInstruction = 'Answer with the single number of the best option.';

  return retryAiCall<number>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
        debugLog,
      });
      const resp = response.text?.trim();
      if (resp) {
        const num = parseInt(resp.trim(), 10);
        if (Number.isInteger(num) && num >= 1 && num <= context.options.length) {
          return { result: num };
        }
      }
    } catch (error: unknown) {
      console.error(`chooseHierarchyResolution_Service error (Attempt ${String(attempt + 1)}/$${String(MAX_RETRIES + 1)}):`, error);
      throw error;
    }
    return { result: null };
  });
};

