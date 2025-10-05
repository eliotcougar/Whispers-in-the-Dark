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
import { itemsToString, npcsToString } from '../../utils/promptFormatters';
import { isDialogueSetupPayloadStructurallyValid } from '../parsers/validation';
import { CORRECTION_TEMPERATURE } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { LOADING_REASON_UI_MAP } from '../../constants';
import { safeParseJson } from '../../utils/jsonUtils';
import { isApiConfigured } from '../geminiClient';
import { retryAiCall } from '../../utils/retry';
import { parseDialogueTurnResponse } from '../dialogue/responseParser';

/**
 * Attempts to correct a malformed DialogueSetupPayload.
 */
export const fetchCorrectedDialogueSetup = async (
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  theme: AdventureTheme,
  allRelevantNPCs: Array<NPC>,
  allRelevantMapNodes: Array<MapNode>,
  currentInventory: Array<Item>,
  heroGender: string,
  malformedDialogueSetup: Partial<DialogueSetupPayload>
): Promise<DialogueSetupPayload | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedDialogueSetup: API Key not configured.');
    return null;
  }

  const npcContextLine = npcsToString(
    allRelevantNPCs,
    '<ID: {id}> - {name}; ',
    '- Known/Available NPCs for Dialogue: ',
    '\n'
  );
  const placeContext = formatKnownPlacesForPrompt(allRelevantMapNodes, true);
  const inventoryContext = itemsToString(
    currentInventory,
    '{name}, ',
    '- Player Inventory: ',
    '\n'
  );
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
- Theme Guidance: "${theme.storyGuidance}"
${npcContextLine}
- Known Map Locations: ${placeContext}
${inventoryContext}
- Player Gender: "${heroGender}"

Required JSON Structure for corrected 'dialogueSetup':
{
  "initialNpcResponses": [{ "speaker": "NPC Name 1", "line": "Their first line." }],
  "initialPlayerOptions": [],
  "participants": ["NPC Name 1", "NPC Name 2"?]
}

Respond ONLY with the single, complete, corrected JSON object for 'dialogueSetup'.`;

  const systemInstruction = `Correct a malformed 'dialogueSetup' JSON payload. Ensure 'participants' are valid NPCs, 'initialNpcResponses' are logical, and 'initialPlayerOptions' are varied with an exit option. Adhere strictly to the JSON format.`;

  let promptToUse = prompt;
  let lastErrorMessage: string | null = null;

  return retryAiCall<DialogueSetupPayload>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      if (attempt > 0 && lastErrorMessage) {
        promptToUse = `${prompt}\n\n[Parser Feedback]\n${lastErrorMessage}`;
      } else {
        promptToUse = prompt;
      }
      const { response } = await dispatchAIRequest({
        modelNames: [GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: promptToUse,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = safeParseJson<DialogueSetupPayload>(response.text ?? '');
      if (aiResponse && isDialogueSetupPayloadStructurallyValid(aiResponse)) {
        lastErrorMessage = null;
        return { result: aiResponse };
      }
      console.warn(
        `fetchCorrectedDialogueSetup (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): Corrected dialogueSetup payload invalid. Response:`,
        aiResponse,
      );
      lastErrorMessage =
        'Corrected dialogueSetup payload must include non-empty initialNpcResponses, initialPlayerOptions, and participants drawn from known NPCs.';
    } catch (error: unknown) {
      console.error(`fetchCorrectedDialogueSetup error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`, error);
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
export const fetchCorrectedDialogueTurn = async (
  malformedResponseText: string,
  validParticipants: Array<string>,
  theme: AdventureTheme,
  npcThoughts?: Array<string>,
): Promise<DialogueAIResponse | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedDialogueTurn: API Key not configured.');
    return null;
  }

  const participantList = validParticipants.map(n => `"${n}"`).join(', ') || 'None';

  const prompt = `Role: You fix malformed JSON for a dialogue turn in a text adventure game.

Theme Guidance: "${theme.storyGuidance}"

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
  "updatedParticipants": ["Name"]?,
  "npcAttitudeUpdates": [{ "name": "Name", "newAttitudeTowardPlayer": "text" }]?
}

Do NOT change the text of any npcResponses.line or playerOptions.
Ensure each "speaker" value is one of the valid participant names.
Respond ONLY with the corrected JSON object.`;

  const systemInstruction = `Correct a malformed dialogue turn JSON object without altering the dialogue text. Speaker names must be among: ${participantList}. Preserve any npcAttitudeUpdates entries if present. Adhere strictly to JSON format.`;

  let promptToUse = prompt;
  let lastErrorMessage: string | null = null;

  return retryAiCall<DialogueAIResponse>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      if (attempt > 0 && lastErrorMessage) {
        promptToUse = `${prompt}\n\n[Parser Feedback]\n${lastErrorMessage}`;
      } else {
        promptToUse = prompt;
      }
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt: promptToUse,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = response.text?.trim() ?? null;
      if (aiResponse) {
        let parseErrorThisAttempt: string | null = null;
        const parsedResponse = parseDialogueTurnResponse(aiResponse, npcThoughts, message => {
          parseErrorThisAttempt = message;
        });
        if (
          parsedResponse?.npcResponses.every(r => validParticipants.includes(r.speaker))
        ) {
          lastErrorMessage = null;
          return { result: parsedResponse };
        }
        console.warn(
          `fetchCorrectedDialogueTurn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): corrected response invalid or speakers not in list.`,
          aiResponse,
        );
      if (typeof parseErrorThisAttempt === 'string') {
        lastErrorMessage = parseErrorThisAttempt;
      } else {
        lastErrorMessage = 'Dialogue response must list npcResponses with valid speakers and provide playerOptions that match schema.';
      }
      } else {
        console.warn(
          `fetchCorrectedDialogueTurn (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI returned empty response.`,
        );
        lastErrorMessage = 'Dialogue response was empty. Return a complete JSON object matching the required structure.';
      }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedDialogueTurn error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
