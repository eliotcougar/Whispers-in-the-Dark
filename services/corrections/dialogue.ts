/**
 * @file services/corrections/dialogue.ts
 * @description Correction helper for malformed dialogue setup payloads.
 */
import { AdventureTheme, Character, MapNode, Item, DialogueSetupPayload } from '../../types';
import { MAX_RETRIES } from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { formatKnownCharactersForPrompt } from '../../utils/promptFormatters/dialogue';
import { isDialogueSetupPayloadStructurallyValid } from '../parsers/validation';
import { callCorrectionAI } from './base';

/**
 * Attempts to correct a malformed DialogueSetupPayload.
 */
export const fetchCorrectedDialogueSetup_Service = async (
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme,
  allRelevantCharacters: Character[],
  allRelevantMapNodes: MapNode[],
  currentInventory: Item[],
  playerGender: string,
  malformedDialogueSetup: Partial<DialogueSetupPayload> | any
): Promise<DialogueSetupPayload | null> => {
  if (!process.env.API_KEY) {
    console.error('fetchCorrectedDialogueSetup_Service: API Key not configured.');
    return null;
  }

  const characterContext = formatKnownCharactersForPrompt(allRelevantCharacters, true);
  const placeContext = formatKnownPlacesForPrompt(allRelevantMapNodes, true);
  const inventoryContext = currentInventory.map(i => i.name).join(', ') || 'Empty';
  const malformedString = JSON.stringify(malformedDialogueSetup);

  const prompt = `
Role: You are an AI assistant correcting a malformed 'dialogueSetup' JSON payload for a text adventure game.
Task: Reconstruct the 'dialogueSetup' object based on narrative context and the malformed data.

Malformed 'dialogueSetup' Payload:
\`\`\`json
${malformedString}
\`\`\`

Narrative Context:
- Log Message: "${logMessageContext || 'Not specified'}"
- Scene Description: "${sceneDescriptionContext || 'Not specified'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"
- Known/Available Characters for Dialogue: ${characterContext}
- Known Map Locations: ${placeContext}
- Player Inventory: ${inventoryContext}
- Player Gender: "${playerGender}"

Required JSON Structure for corrected 'dialogueSetup':
{
  "participants": ["Character Name 1", "Character Name 2"?],
  "initialNpcResponses": [{ "speaker": "Character Name 1", "line": "Their first line." }],
  "initialPlayerOptions": []
}

Respond ONLY with the single, complete, corrected JSON object for 'dialogueSetup'.`;

  const systemInstructionForFix = `Correct a malformed 'dialogueSetup' JSON payload. Ensure 'participants' are valid NPCs, 'initialNpcResponses' are logical, and 'initialPlayerOptions' are varied with an exit option. Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI(prompt, systemInstructionForFix);
    if (correctedPayload && isDialogueSetupPayloadStructurallyValid(correctedPayload)) {
      return correctedPayload as DialogueSetupPayload;
    } else {
      console.warn(`fetchCorrectedDialogueSetup_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected dialogueSetup payload invalid. Response:`, correctedPayload);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};
