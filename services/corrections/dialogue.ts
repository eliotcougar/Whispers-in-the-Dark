/**
 * @file services/corrections/dialogue.ts
 * @description Correction helper for malformed dialogue setup payloads.
 */
import { AdventureTheme, NPC, MapNode, Item, DialogueSetupPayload, DialogueAIResponse } from '../../types';
import {
  MAX_RETRIES,
  MINIMAL_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { npcsToString } from '../../utils/promptFormatters';
import { isDialogueSetupPayloadStructurallyValid } from '../parsers/validation';
import { CORRECTION_TEMPERATURE } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { LOADING_REASON_UI_MAP } from '../../constants';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
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
  allRelevantNPCs: Array<NPC>,
  allRelevantMapNodes: Array<MapNode>,
  currentInventory: Array<Item>,
  heroGender: string,
  malformedDialogueSetup: Partial<DialogueSetupPayload>
): Promise<DialogueSetupPayload | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedDialogueSetup_Service: API Key not configured.');
    return null;
  }

  const npcContext =
    allRelevantNPCs.length > 0
      ? npcsToString(allRelevantNPCs, ' - ')
      : 'None specifically known in this theme yet.';
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
- Log Message: "${logMessageContext ?? 'Not specified'}"
- Scene Description: "${sceneDescriptionContext ?? 'Not specified'}"
- Theme Guidance: "${currentTheme.storyGuidance}"
- Known/Available NPCs for Dialogue: ${npcContext}
- Known Map Locations: ${placeContext}
- Player Inventory: ${inventoryContext}
 - Player Gender: "${heroGender}"

Required JSON Structure for corrected 'dialogueSetup':
{
  "initialNpcResponses": [{ "speaker": "NPCr Name 1", "line": "Their first line." }],
  "initialPlayerOptions": [],
  "participants": ["NPC Name 1", "NPC Name 2"?]
}

Respond ONLY with the single, complete, corrected JSON object for 'dialogueSetup'.`;

  const systemInstruction = `Correct a malformed 'dialogueSetup' JSON payload. Ensure 'participants' are valid NPCs, 'initialNpcResponses' are logical, and 'initialPlayerOptions' are varied with an exit option. Adhere strictly to the JSON format.`;

  return retryAiCall<DialogueSetupPayload>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = safeParseJson<DialogueSetupPayload>(extractJsonFromFence(response.text ?? ''));
      if (aiResponse && isDialogueSetupPayloadStructurallyValid(aiResponse)) {
        return { result: aiResponse };
      }
      console.warn(
        `fetchCorrectedDialogueSetup_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): Corrected dialogueSetup payload invalid. Response:`,
        aiResponse,
      );
    } catch (error: unknown) {
      console.error(`fetchCorrectedDialogueSetup_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`, error);
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
  validParticipants: Array<string>,
  currentTheme: AdventureTheme,
  npcThoughts?: Array<string>,
): Promise<DialogueAIResponse | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedDialogueTurn_Service: API Key not configured.');
    return null;
  }

  const participantList = validParticipants.map(n => `"${n}"`).join(', ') || 'None';

  const prompt = `Role: You fix malformed JSON for a dialogue turn in a text adventure game.

Theme Guidance: "${currentTheme.storyGuidance}"

Malformed Dialogue Response:
\`\`\`
${malformedResponseText}
\`\`\`

Valid Participant Names: [${participantList}]

Required JSON Structure:
{
  "dialogueEnds": boolean?,
  "npcResponses": [{ "speaker": "Name", "line": "text" }],
  "playerOptions": ["text"],
  "updatedParticipants": ["Name"]?
}

Do NOT change the text of any npcResponses.line or playerOptions.
Ensure each "speaker" value is one of the valid participant names.
Respond ONLY with the corrected JSON object.`;

  const systemInstruction = `Correct a malformed dialogue turn JSON object without altering the dialogue text. Speaker names must be among: ${participantList}. Adhere strictly to JSON format.`;

  return retryAiCall<DialogueAIResponse>(async attempt => {
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
      if (aiResponse) {
        const parsedResponse = parseDialogueTurnResponse(aiResponse, npcThoughts);
        if (
          parsedResponse?.npcResponses.every(r => validParticipants.includes(r.speaker))
        ) {
          return { result: parsedResponse };
        }
        console.warn(
          `fetchCorrectedDialogueTurn_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): corrected response invalid or speakers not in list.`,
          aiResponse,
        );
      } else {
        console.warn(
          `fetchCorrectedDialogueTurn_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI returned empty response.`,
        );
      }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedDialogueTurn_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
