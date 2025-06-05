/**
 * @file services/corrections/base.ts
 * @description Shared utilities for calling the AI correction models.
 */
import { AUXILIARY_MODEL_NAME, MINIMAL_MODEL_NAME, GEMINI_MODEL_NAME } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { isApiConfigured } from '../apiClient';
import { isServerOrClientError } from '../../utils/aiErrorUtils';

/** Temperature used for all correction related AI calls. */
export const CORRECTION_TEMPERATURE = 0.75;

/**
 * Makes a single AI call expecting a JSON response and parses the result.
 * Uses AUXILIARY_MODEL_NAME.
 */
export const callCorrectionAI = async (
  prompt: string,
  systemInstruction: string
): Promise<any | null> => {
  try {
    const response = await dispatchAIRequest(
      [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      {
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
      }
    );
    let jsonStr = (response.text ?? '').trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const fenceMatch = jsonStr.match(fenceRegex);
    if (fenceMatch && fenceMatch[1]) {
      jsonStr = fenceMatch[1].trim();
    }
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error(`callCorrectionAI: Error during single AI call or parsing for prompt starting with "${prompt.substring(0, 100)}...":`, error);
    if (isServerOrClientError(error)) {
      return null;
    }
    return null;
  }
};

/**
 * Makes a single AI call expecting a simple string response using MINIMAL_MODEL_NAME.
 * Concatenates systemInstruction with prompt since that model does not support a separate system instruction.
 */
export const callMinimalCorrectionAI = async (
  prompt: string,
  systemInstruction: string
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('callMinimalCorrectionAI: API Key not configured.');
    return null;
  }

  try {
    const response = await dispatchAIRequest(
      [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
      prompt,
      systemInstruction,
      { temperature: CORRECTION_TEMPERATURE }
    );
    return response.text?.trim() ?? null;
  } catch (error) {
    console.error(
      `callMinimalCorrectionAI: Error during AI call for prompt starting with "${prompt.substring(0,100)}...":`,
      error
    );
    return null;
  }
};
