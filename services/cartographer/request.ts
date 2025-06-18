/**
 * @file request.ts
 * @description Helpers for sending map update requests to the cartographer AI.
 */
import { GenerateContentResponse } from '@google/genai';
import {
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
  MAX_RETRIES,
  LOADING_REASON_UI_MAP,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';
import {
  parseAIMapUpdateResponse,
} from './responseParser';
import {
  normalizeRemovalUpdates,
  dedupeEdgeOps,
  normalizeStatusAndTypeSynonyms,
  fixDeleteIdMixups,
} from './mapUpdateUtils';
import type {
  AIMapUpdatePayload,
  MinimalModelCallRecord,
} from '../../types';
import type { MapUpdateDebugInfo } from './types';

/**
 * Executes the cartographer AI request with model fallback.
 */
export const executeMapUpdateRequest = async (
  prompt: string,
  systemInstruction: string,
): Promise<GenerateContentResponse> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Map Update Service.');
    throw new Error('API Key not configured.');
  }
  const result = await retryAiCall<GenerateContentResponse>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP['map'].icon);
    const { response } = await dispatchAIRequest({
      modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.75,
      label: 'Cartographer',
    });
    return { result: response };
  });
  if (!result) {
    throw new Error('Failed to execute map update request.');
  }
  return result;
};

export interface MapUpdateRequestResult {
  payload: AIMapUpdatePayload | null;
  debugInfo: MapUpdateDebugInfo;
}

/**
 * Requests a map update payload and validates the response.
 */
export const fetchMapUpdatePayload = async (
  basePrompt: string,
  systemInstruction: string,
  minimalModelCalls: Array<MinimalModelCallRecord>,
): Promise<MapUpdateRequestResult> => {
  let prompt = basePrompt;
  const debugInfo: MapUpdateDebugInfo = {
    prompt: basePrompt,
    observations: undefined,
    rationale: undefined,
    minimalModelCalls,
    connectorChainsDebugInfo: [],
  };
  let validParsedPayload: AIMapUpdatePayload | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; ) {
    try {
      console.log(`Map Update Service: Attempt ${attempt + 1}/${MAX_RETRIES}`);
      if (attempt > 0 && debugInfo.validationError) {
        prompt = `${basePrompt}\nCRITICALLY IMPORTANT: ${debugInfo.validationError}`;
      } else {
        prompt = basePrompt;
      }
      debugInfo.prompt = prompt;
      const response = await executeMapUpdateRequest(prompt, systemInstruction);
      debugInfo.rawResponse = response.text ?? '';
      const parsedAttempt = parseAIMapUpdateResponse(response.text ?? '');
      if (parsedAttempt) {
        debugInfo.observations = parsedAttempt.observations ?? debugInfo.observations;
        debugInfo.rationale = parsedAttempt.rationale ?? debugInfo.rationale;
        normalizeRemovalUpdates(parsedAttempt);
        fixDeleteIdMixups(parsedAttempt);
        const synonymErrors = normalizeStatusAndTypeSynonyms(parsedAttempt);
        dedupeEdgeOps(parsedAttempt);
        if (!synonymErrors.length) {
          validParsedPayload = parsedAttempt;
          debugInfo.parsedPayload = parsedAttempt;
          debugInfo.validationError = undefined;
          break;
        }
        debugInfo.parsedPayload = parsedAttempt;
        debugInfo.validationError =
          synonymErrors.length > 0
            ? `Invalid values: ${synonymErrors.join('; ')}`
            : 'Parsed payload failed structural/value validation.';
      } else {
        debugInfo.validationError = 'Failed to parse AI response into valid JSON map update payload.';
      }
      if (attempt === MAX_RETRIES - 1) {
        console.error('Map Update Service: Failed to get valid map update payload after all retries.');
      }
      attempt++;
    } catch (error) {
      console.error(`Error in map update request (Attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      debugInfo.rawResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
      debugInfo.validationError = `Processing error: ${error instanceof Error ? error.message : String(error)}`;
      if (attempt === MAX_RETRIES - 1) {
        break;
      }
      attempt++;
    }
  }

  return { payload: validParsedPayload, debugInfo };
};
