/**
 * @file services/corrections/name.ts
 * @description Correction helper for resolving malformed entity names.
 */
import { AdventureTheme } from '../../types';
import { MAX_RETRIES } from '../../constants';
import { callMinimalCorrectionAI } from './base';

/**
 * Attempts to match a malformed name against a list of valid names.
 */
export const fetchCorrectedName_Service = async (
  entityTypeToCorrect: string,
  malformedOrPartialName: string,
  contextualLogMessage: string | undefined,
  contextualSceneDescription: string | undefined,
  validNamesList: string[],
  currentTheme: AdventureTheme
): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.error(`fetchCorrectedName_Service: API Key not configured. Cannot correct ${entityTypeToCorrect} name.`);
    return null;
  }
  if (validNamesList.length === 0) {
    console.warn(`fetchCorrectedName_Service: No valid names provided for ${entityTypeToCorrect} to match against. Returning original: "${malformedOrPartialName}".`);
    return malformedOrPartialName;
  }

  const validNamesContext = `The corrected ${entityTypeToCorrect} name MUST be one of these exact, case-sensitive full names: [${validNamesList.map(name => `"${name}"`).join(', ')}].`;

  const prompt = `
Role: You are an AI assistant specialized in matching a potentially incorrect or partial entity name against a predefined list of valid names, using narrative context.
Entity Type: ${entityTypeToCorrect}
Malformed/Partial Name Provided by another AI: "${malformedOrPartialName}"

Narrative Context (use this to understand which entity was likely intended):
- Log Message: "${contextualLogMessage || 'Not specified, infer from scene.'}"
- Scene Description: "${contextualSceneDescription || 'Not specified, infer from log.'}"

List of Valid Names:
${validNamesContext}

Task: Based on the context and the list of valid names, determine the correct full string name.
Respond ONLY with the single, corrected ${entityTypeToCorrect} name as a string.
If no suitable match can be confidently made, respond with an empty string.`;

  const systemInstructionForFix = `Your task is to match a malformed ${entityTypeToCorrect} name against a provided list of valid names, using narrative context. Respond ONLY with the best-matched string from the valid list, or an empty string if no confident match is found. Adhere to the theme context: ${currentTheme.systemInstructionModifier || 'General interpretation.'}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedNameResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix);

    if (correctedNameResponse !== null) {
      const correctedName = correctedNameResponse.trim();
      if (correctedName === '') {
        console.warn(`fetchCorrectedName_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI indicated no match for ${entityTypeToCorrect} "${malformedOrPartialName}" from the valid list.`);
        return null;
      }
      if (validNamesList.includes(correctedName)) {
        console.warn(`fetchCorrectedName_Service: Returned corrected Name `, correctedName, `.`);
        return correctedName;
      } else {
        console.warn(`fetchCorrectedName_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI returned name "${correctedName}" for ${entityTypeToCorrect} which is NOT in the validNamesList. Discarding result.`);
      }
    } else {
      console.warn(`fetchCorrectedName_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI call failed for ${entityTypeToCorrect}. Received: null`);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};
