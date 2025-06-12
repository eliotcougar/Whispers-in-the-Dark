/**
 * @file services/corrections/base.ts
 * @description Shared utilities for calling the AI correction models.
 */
import { AUXILIARY_MODEL_NAME, MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { MinimalModelCallRecord } from '../../types';
import { isApiConfigured } from '../apiClient';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { addProgressSymbol } from '../../utils/loadingProgress';

/** Temperature used for all correction related AI calls. */
export const CORRECTION_TEMPERATURE = 0.75;

/**
 * Makes a single AI call expecting a JSON response and parses the result.
 * Uses AUXILIARY_MODEL_NAME.
 */
/**
 * Dispatches a JSON-returning AI request using the auxiliary model.
 * The generic type allows callers to specify the expected shape of the
 * parsed JSON result.
 */
export const callCorrectionAI = async <T = unknown>(
  prompt: string,
  systemInstruction: string
): Promise<T | null> => {
  addProgressSymbol('●');
  try {
    const { response } = await dispatchAIRequest({
      modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: CORRECTION_TEMPERATURE,
      label: 'Corrections',
    });
    const jsonStr = extractJsonFromFence(response.text ?? '');
    const parsed = safeParseJson<T>(jsonStr);
    if (parsed) return parsed;
    throw new Error('JSON parse failed');
  } catch (error) {
    console.error(`callCorrectionAI: Error during single AI call or parsing for prompt starting with "${prompt.substring(0, 100)}...":`, error);
    throw error;
  }
};

/**
 * Makes a single AI call expecting a simple string response using MINIMAL_MODEL_NAME.
 * Concatenates systemInstruction with prompt since that model does not support a separate system instruction.
 */
export const callMinimalCorrectionAI = async (
  prompt: string,
  systemInstruction: string,
  debugLog?: MinimalModelCallRecord[]
): Promise<string | null> => {
  addProgressSymbol('○');
  if (!isApiConfigured()) {
    console.error('callMinimalCorrectionAI: API Key not configured.');
    return null;
  }

  try {
    const { response } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      temperature: CORRECTION_TEMPERATURE,
      label: 'Corrections',
      debugLog,
    });
    return response.text?.trim() ?? null;
  } catch (error) {
    console.error(
      `callMinimalCorrectionAI: Error during AI call for prompt starting with "${prompt.substring(0,100)}...":`,
      error
    );
    throw error;
  }
};
