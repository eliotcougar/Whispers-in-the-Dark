/**
 * @file services/corrections/name.ts
 * @description Correction helper for resolving malformed entity names.
 */
import { AdventureTheme } from '../../types';
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
import { isApiConfigured } from '../apiClient';

/**
 * Attempts to match a malformed name against a list of valid names.
 */
export const fetchCorrectedName_Service = async (
  entityTypeToCorrect: string,
  malformedOrPartialName: string,
  contextualLogMessage: string | undefined,
  contextualSceneDescription: string | undefined,
  validNamesList: Array<string>,
  currentTheme: AdventureTheme
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error(`fetchCorrectedName_Service: API Key not configured. Cannot correct ${entityTypeToCorrect} name.`);
    return null;
  }
  if (validNamesList.length === 0) {
    console.warn(`fetchCorrectedName_Service: No valid names provided for ${entityTypeToCorrect} to match against. Returning original: "${malformedOrPartialName}".`);
    return malformedOrPartialName;
  }

  const validNamesContext = `The corrected ${entityTypeToCorrect} name MUST be one of these exact, case-sensitive full names: [${validNamesList.map(name => `"${name}"`).join(', ')}].`;

  const prompt = `
You are an AI assistant specialized in matching a potentially incorrect or partial entity name against a predefined list of valid names, using narrative context.
Entity Type: ${entityTypeToCorrect}
Malformed/Partial Name Provided by another AI: "${malformedOrPartialName}"

Narrative Context (use this to understand which entity was likely intended):
- Log Message: "${contextualLogMessage ?? 'Not specified, infer from scene.'}"
- Scene Description: "${contextualSceneDescription ?? 'Not specified, infer from log.'}"

List of Valid Names:
${validNamesContext}

Task: Based on the context and the list of valid names, determine the correct full string name.
Respond ONLY with the single, corrected ${entityTypeToCorrect} name as a string.
If no suitable match can be confidently made, respond with an empty string.`;

  const systemInstruction = `Your task is to match a malformed ${entityTypeToCorrect} name against a provided list of valid names, using narrative context. Respond ONLY with the best-matched string from the valid list, or an empty string if no confident match is found. Adhere to the theme context: ${currentTheme.storyGuidance}`;

  return retryAiCall<string>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = response.text?.trim() ?? null;
      if (aiResponse !== null) {
        let correctedName = aiResponse.trim();
        correctedName = correctedName.replace(/^['"]+|['"]+$/g, '').trim();
        if (correctedName === '') {
          console.warn(
            `fetchCorrectedName_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI indicated no match for ${entityTypeToCorrect} "${malformedOrPartialName}" from the valid list.`,
          );
          return { result: null, retry: false };
        }
        if (validNamesList.includes(correctedName)) {
          console.warn(`fetchCorrectedName_Service: Returned corrected Name `, correctedName, `.`);
          return { result: correctedName };
        }
        console.warn(
          `fetchCorrectedName_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI returned name "${correctedName}" for ${entityTypeToCorrect} which is NOT in the validNamesList. Discarding result.`,
        );
      } else {
        console.warn(
          `fetchCorrectedName_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI call failed for ${entityTypeToCorrect}. Received: null`,
        );
      }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedName_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
