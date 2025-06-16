/**
 * @file services/corrections/dialogue.ts
 * @description Correction helper for malformed dialogue setup payloads.
 */
import { AdventureTheme, Character, MapNode, Item, DialogueSetupPayload, DialogueAIResponse } from '../../types';
import { MAX_RETRIES } from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { formatKnownCharactersForPrompt } from '../../utils/promptFormatters';
import { isDialogueSetupPayloadStructurallyValid } from '../parsers/validation';
import { callCorrectionAI, callMinimalCorrectionAI } from './base';
import { isApiConfigured } from '../apiClient';
import { retryAiCall } from '../../utils/retry';
import { parseDialogueTurnResponse } from '../dialogue/responseParser';

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
  malformedDialogueSetup: Partial<DialogueSetupPayload>
): Promise<DialogueSetupPayload | null> => {
  if (!isApiConfigured()) {
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

  const systemInstruction = `Correct a malformed 'dialogueSetup' JSON payload. Ensure 'participants' are valid NPCs, 'initialNpcResponses' are logical, and 'initialPlayerOptions' are varied with an exit option. Adhere strictly to the JSON format.`;

  return retryAiCall<DialogueSetupPayload>(async attempt => {
    try {
      const aiResponse = await callCorrectionAI<DialogueSetupPayload>(prompt, systemInstruction);
      if (aiResponse && isDialogueSetupPayloadStructurallyValid(aiResponse)) {
        return { result: aiResponse };
      }
      console.warn(
        `fetchCorrectedDialogueSetup_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected dialogueSetup payload invalid. Response:`,
        aiResponse,
      );
    } catch (error) {
      console.error(`fetchCorrectedDialogueSetup_Service error (Attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, error);
      throw error;
    }
    return { result: null };
  });
};

/**
 * Attempts to correct a malformed DialogueAIResponse for a single dialogue turn.
 * The original NPC thoughts (if any) should be provided so they can be
 * reattached to the corrected response.
 */
export const fetchCorrectedDialogueTurn_Service = async (
  malformedResponseText: string,
  validParticipants: string[],
  currentTheme: AdventureTheme,
  npcThoughts?: string[],
): Promise<DialogueAIResponse | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedDialogueTurn_Service: API Key not configured.');
    return null;
  }

  const participantList = validParticipants.map(n => `"${n}"`).join(', ') || 'None';

  const prompt = `
Role: You fix malformed JSON for a dialogue turn in a text adventure game.

Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Malformed Dialogue Response:
\`\`\`
${malformedResponseText}
\`\`\`

Valid Participant Names: [${participantList}]

Required JSON Structure:
{
  "npcResponses": [{ "speaker": "Name", "line": "text" }],
  "playerOptions": ["text"],
  "dialogueEnds": boolean?,
  "updatedParticipants": ["Name"]?
}

Do NOT change the text of any npcResponses.line or playerOptions.
Ensure each "speaker" value is one of the valid participant names.
Respond ONLY with the corrected JSON object.`;

  const systemInstruction = `Correct a malformed dialogue turn JSON object without altering the dialogue text. Speaker names must be among: ${participantList}. Adhere strictly to JSON format.`;

  return retryAiCall<DialogueAIResponse>(async attempt => {
    try {
      const aiResponse = await callMinimalCorrectionAI(prompt, systemInstruction);
      if (aiResponse) {
        const parsedResponse = parseDialogueTurnResponse(aiResponse, npcThoughts);
        if (
          parsedResponse &&
          parsedResponse.npcResponses.every(r => validParticipants.includes(r.speaker))
        ) {
          return { result: parsedResponse };
        }
        console.warn(
          `fetchCorrectedDialogueTurn_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): corrected response invalid or speakers not in list.`,
          aiResponse,
        );
      } else {
        console.warn(
          `fetchCorrectedDialogueTurn_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI returned empty response.`,
        );
      }
    } catch (error) {
      console.error(
        `fetchCorrectedDialogueTurn_Service error (Attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
