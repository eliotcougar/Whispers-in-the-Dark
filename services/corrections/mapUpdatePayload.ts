/**
 * @file services/corrections/mapUpdatePayload.ts
 * @description Correction helper for malformed map update payloads.
 */
import { AdventureTheme, AIMapUpdatePayload } from '../../types';
import {
  MAX_RETRIES,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  VALID_NODE_STATUS_STRING,
  VALID_NODE_TYPE_STRING,
  VALID_EDGE_STATUS_STRING,
  VALID_EDGE_TYPE_STRING,
  NODE_DESCRIPTION_INSTRUCTION,
  EDGE_DESCRIPTION_INSTRUCTION,
  ALIAS_INSTRUCTION,
  CORRECTION_TEMPERATURE,
  LOADING_REASON_UI_MAP,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { safeParseJson } from '../../utils/jsonUtils';
import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../geminiClient';
import { isValidAIMapUpdatePayload } from '../cartographer/mapUpdateValidation';
import { normalizeStatusAndTypeSynonyms } from '../cartographer/mapUpdateUtils';

export const fetchCorrectedMapUpdatePayload_Service = async (
  malformedJson: string,
  validationError: string | undefined,
  theme: AdventureTheme,
): Promise<AIMapUpdatePayload | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedMapUpdatePayload_Service: API Key not configured.');
    return null;
  }

  const basePrompt = `You are an AI assistant fixing a malformed map update payload for a text adventure game.
\nMalformed JSON:\n\`\`\`json\n${malformedJson}\n\`\`\`\nValidation Error: "${validationError ?? 'Unknown'}"\nRespond ONLY with the corrected JSON object.`;

  const systemInstruction = `Correct the map update payload so it adheres to the expected structure. Valid node types: ${VALID_NODE_TYPE_STRING}. Valid node statuses: ${VALID_NODE_STATUS_STRING}. Valid edge types: ${VALID_EDGE_TYPE_STRING}. Valid edge statuses: ${VALID_EDGE_STATUS_STRING}. ${NODE_DESCRIPTION_INSTRUCTION} ${EDGE_DESCRIPTION_INSTRUCTION} ${ALIAS_INSTRUCTION} Theme Guidance: ${theme.storyGuidance}`;

  let promptToUse = basePrompt;
  let lastErrorMessage: string | null = validationError ?? null;

  return retryAiCall<AIMapUpdatePayload>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      if (attempt > 0 && lastErrorMessage) {
        promptToUse = `${basePrompt}\n\n[Parser Feedback]\n${lastErrorMessage}`;
      } else {
        promptToUse = basePrompt;
      }
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: promptToUse,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = safeParseJson<AIMapUpdatePayload>(response.text ?? '');
      if (aiResponse) {
        normalizeStatusAndTypeSynonyms(aiResponse);
        const valid = isValidAIMapUpdatePayload(aiResponse);
        if (valid) {
          lastErrorMessage = null;
          return { result: aiResponse };
        }
      }
      console.warn(`fetchCorrectedMapUpdatePayload_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): corrected payload invalid.`, aiResponse);
      lastErrorMessage =
        'Corrected map update payload must include valid nodes/edges arrays that follow the documented schema and reference existing locations.';
    } catch (error: unknown) {
      console.error(`fetchCorrectedMapUpdatePayload_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`, error);
      throw error;
    }
    return { result: null };
  });
};
