/**
 * @file request.ts
 * @description Helpers for sending map update requests to the cartographer AI.
 */
import { GenerateContentResponse } from '@google/genai';
import {
  GEMINI_LITE_MODEL_NAME,
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
): Promise<{ response: GenerateContentResponse; thoughts: Array<string> }> => {
  if (!isApiConfigured()) {
    console.error('API Key not configured for Map Update Service.');
    throw new Error('API Key not configured.');
  }
  const result = await retryAiCall<{ response: GenerateContentResponse; thoughts: Array<string> }>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.map.icon);
    const { response } = await dispatchAIRequest({
      modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      thinkingBudget: 4096,
      includeThoughts: true,
      responseMimeType: 'application/json',
      temperature: 0.75,
      label: 'Cartographer',
    });
    const parts = (response.candidates?.[0]?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>;
    const thoughtParts = parts
      .filter((p): p is { text: string; thought?: boolean } => p.thought === true && typeof p.text === 'string')
      .map(p => p.text);
    return { result: { response, thoughts: thoughtParts } };
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
    systemInstruction,
    jsonSchema: undefined,
    observations: undefined,
    rationale: undefined,
    minimalModelCalls,
    connectorChainsDebugInfo: [],
  };
  let validParsedPayload: AIMapUpdatePayload | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; ) {
    try {
      console.log(`Map Update Service: Attempt ${String(attempt + 1)}/${String(MAX_RETRIES)}`);
      if (attempt > 0 && debugInfo.validationError) {
        prompt = `${basePrompt}\nCRITICALLY IMPORTANT: Your previous attempt has triggered an error: ${debugInfo.validationError}`;
      } else {
        prompt = basePrompt;
      }
      debugInfo.prompt = prompt;
      const { response, thoughts } = await executeMapUpdateRequest(prompt, systemInstruction);
      debugInfo.rawResponse = response.text ?? '';
      if (thoughts.length > 0) debugInfo.thoughts = thoughts;
      const { payload: parsedPayload, validationError: parseError } = parseAIMapUpdateResponse(response.text ?? '');
      if (parsedPayload) {
        debugInfo.observations = parsedPayload.observations ?? debugInfo.observations;
        debugInfo.rationale = parsedPayload.rationale ?? debugInfo.rationale;
        normalizeRemovalUpdates(parsedPayload);
        fixDeleteIdMixups(parsedPayload);
        const synonymErrors = normalizeStatusAndTypeSynonyms(parsedPayload);
        dedupeEdgeOps(parsedPayload);
        if (!synonymErrors.length) {
          validParsedPayload = parsedPayload;
          debugInfo.parsedPayload = parsedPayload;
          debugInfo.validationError = undefined;
          break;
        }
        debugInfo.parsedPayload = parsedPayload;
        debugInfo.validationError =
          synonymErrors.length > 0
            ? `Invalid values: ${synonymErrors.join('; ')}`
            : 'Parsed payload failed structural/value validation.';
      } else {
        debugInfo.validationError = parseError ?? 'Failed to parse AI response into valid JSON map update payload.';
      }
      if (attempt === MAX_RETRIES - 1) {
        console.error('Map Update Service: Failed to get valid map update payload after all retries.');
      }
      attempt++;
    } catch (error: unknown) {
      console.error(`Error in map update request (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES)}):`, error);
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
