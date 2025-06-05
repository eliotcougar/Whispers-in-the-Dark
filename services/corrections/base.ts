/**
 * @file services/corrections/base.ts
 * @description Shared utilities for calling the AI correction models.
 */
import { AUXILIARY_MODEL_NAME, MINIMAL_MODEL_NAME } from '../../constants';
import { ai } from '../geminiClient';
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
    const response = await ai.models.generateContent({
      model: AUXILIARY_MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
      },
    });
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

  const fullPrompt = `${systemInstruction}\n\n${prompt}`;

  try {
    const response = await ai.models.generateContent({
      model: MINIMAL_MODEL_NAME,
      contents: fullPrompt,
      config: { temperature: CORRECTION_TEMPERATURE },
    });
    return response.text?.trim() ?? null;
  } catch (error) {
    console.error(
      `callMinimalCorrectionAI: MINIMAL_MODEL failed for prompt starting with "${prompt.substring(0,100)}...":`,
      error
    );
    if (isServerOrClientError(error)) {
      try {
        console.warn('callMinimalCorrectionAI: Falling back to AUXILIARY_MODEL due to error.');
        const fallbackResp = await ai.models.generateContent({
          model: AUXILIARY_MODEL_NAME,
          contents: fullPrompt,
          config: { temperature: CORRECTION_TEMPERATURE },
        });
        return fallbackResp.text?.trim() ?? null;
      } catch (fallbackError) {
        console.error('callMinimalCorrectionAI: Fallback AUXILIARY_MODEL failed:', fallbackError);
        return null;
      }
    }
    return null;
  }
};
