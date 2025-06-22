/**
 * @file services/corrections/item.ts
 * @description Correction helpers for item related data.
 */
import { Item, AdventureTheme, ItemChange } from '../../types';
import {
  MAX_RETRIES,
  VALID_ITEM_TYPES_STRING,
  MINIMAL_MODEL_NAME,
  AUXILIARY_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { isValidItem } from '../parsers/validation';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isApiConfigured } from '../apiClient';
import { retryAiCall } from '../../utils/retry';

/**
 * Fetches a corrected item payload from the AI when an itemChange object is malformed.
 */
export const fetchCorrectedItemPayload_Service = async (
  actionType: 'gain' | 'update',
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  malformedPayloadString: string,
  currentTheme: AdventureTheme
): Promise<Item | null> => {
  if (!isApiConfigured()) {
    console.error(`fetchCorrectedItemPayload_Service: API Key not configured. Cannot correct item payload for action "${actionType}".`);
    return null;
  }

  let originalItemNameFromMalformed = 'Not specified or unparseable from malformed payload';
  try {
    const malformedObj = safeParseJson<Record<string, unknown>>(malformedPayloadString);
    if (malformedObj && typeof malformedObj.name === 'string') {
      originalItemNameFromMalformed = `"${malformedObj.name}"`;
    }
  } catch {
    /* ignore parse error */
  }

  const knownUseStructureGuide = `
For "knownUses" (array of objects) or "addKnownUse" (single object): Each "Known Use" object REQUIRES:
- "actionName": string
- "promptEffect": string
- "description": string
- "appliesWhenActive?": boolean
- "appliesWhenInactive?": boolean
If neither appliesWhen... field is given, use always shown. If both, applies if (isActive AND appliesWhenActive) OR (!isActive AND appliesWhenInactive).
`;

  const baseItemStructureForPrompt = `
{
  "name": "string",
  "type": "(${VALID_ITEM_TYPES_STRING})",
  "description": "string",
  "activeDescription?": "string",
  "isActive?": boolean,
  "tags?": ["junk"],
  "chapters"?: [
    { 
      "heading": "string",
      "description": "string",
      "contentLength": number /* Range: 50-500 */
    }
  ]
  "knownUses?": [ ],
  "newName?": "string",
  "addKnownUse?": { }
}`;

  let itemContextDescription = '';
  let specificActionInstructions = '';

  if (actionType === 'gain') {
    itemContextDescription = 'a new item acquisition';
  specificActionInstructions = `Based *strictly* on Log/Scene and malformed payload:
  - Provide "name", "type", "description" for the gained item. These MUST be non-empty.
  - Choose "type" from: ${VALID_ITEM_TYPES_STRING}. The 'type' CANNOT be 'junk'. If the item is junk, add "junk" to its "tags" array and pick a suitable type.
  - "isActive" defaults to false. The "tags" array defaults to []. "status effect" items can never have the "junk" tag.
  - For items with type "page", provide a numeric "contentLength" (up to 250 words).
  - "knownUses" is optional.
  - The "newName" and "addKnownUse" fields should NOT be used for "gain".
  ${knownUseStructureGuide}`;
  } else {
    itemContextDescription = 'an item update or transformation';
    specificActionInstructions = `Your goal is to correct the 'Malformed Payload' for an "update" action.
The "name" field in the corrected JSON **MUST** be the *original name* of item being updated. If this original name is unclear from malformed payload, infer it from Log/Scene, ideally referencing "${originalItemNameFromMalformed}".
Instructions for "update":
1.  **Simple Update (No Transformation):** If the malformed payload does NOT contain a "newName" AND the Log/Scene context does NOT clearly indicate the item is transforming into something else:
    -   Only include fields ("type", "description", "isActive", "tags", "contentLength", "knownUses", "addKnownUse") if they are being explicitly changed or were present in the original payload.
    -   If "type" or "description" are not provided, the item's existing values will be retained.
    -   If "type" is provided, it must be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the item becomes junk, ensure "tags" includes "junk".
2.  **Transformation (Using "newName"):** If the malformed payload contains a "newName" OR the context clearly indicates a transformation:
    -   The corrected payload MUST include the "newName" field.
    -   Optionally include "type" and "description" if they change; otherwise they will be inherited.
    -   If "type" is provided, it must be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the new item is junk, ensure "tags" includes "junk".
    -   If the resulting type is "page", include or update "contentLength" if available.
3.  **Known Uses:**
    -   "knownUses" replaces all existing known uses if provided.
    -   "addKnownUse" adds or updates a single known use.
    -   ${knownUseStructureGuide}
4.  Ensure all present fields are valid.`;
  }

  const prompt = `
Role: You are an AI assistant tasked with correcting malformed JSON item payloads for a text adventure game.
Task: Reconstruct the 'item' part of an ItemChange object based on the provided context and the malformed data.
Action Type: "${actionType}" (this concerns ${itemContextDescription}).

Malformed 'item' Payload:
\`\`\`json
${malformedPayloadString}
\`\`\`

Narrative Context:
- Log Message: "${logMessage ?? 'Not specified, infer from scene.'}"
- Scene Description: "${sceneDescription ?? 'Not specified, infer from log.'}"
 - Theme Guidance: "${currentTheme.systemInstructionModifier}"

Required JSON Structure for the corrected 'item' field:
${baseItemStructureForPrompt}

Specific Instructions for action "${actionType}":
${specificActionInstructions}

Respond ONLY with the single, complete, corrected JSON object for the 'item' field.`;

  const systemInstruction = `Correct JSON item payloads based on the provided structure, context, and specific instructions for the action type. Adhere strictly to the JSON format. Preserve the original intent of the item change if discernible. CRITICAL: Ensure the 'type' field is never 'junk'; use the 'tags' array with "junk" and a valid type instead.`;

  return retryAiCall<Item>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const jsonStr = response.text ?? '';
      const aiResponse = safeParseJson<Item>(extractJsonFromFence(jsonStr));
      if (aiResponse && isValidItem(aiResponse, actionType === 'gain' ? 'gain' : 'update')) {
        return { result: aiResponse };
      }
      console.warn(
        `fetchCorrectedItemPayload_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): Corrected '${actionType}' payload invalid after validation. Response:`,
        aiResponse,
      );
    } catch (error: unknown) {
      console.error(`fetchCorrectedItemPayload_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`, error);
      throw error;
    }
    return { result: null };
  });
};

/**
 * Fetches a corrected item action when the 'action' field is missing or malformed.
 */
export const fetchCorrectedItemAction_Service = async (
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  malformedItemChangeString: string,
  currentTheme: AdventureTheme
): Promise<ItemChange['action'] | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedItemAction_Service: API Key not configured. Cannot correct item action.');
    return null;
  }

  // Basic check before engaging the AI
  try {
    const parsed = safeParseJson<Record<string, unknown>>(malformedItemChangeString);
    if (parsed && typeof parsed === 'object') {
      const rawAction = parsed.action;
      if (typeof rawAction === 'string' && ['gain', 'destroy', 'update', 'put', 'give', 'take'].includes(rawAction)) {
        return rawAction as ItemChange['action'];
      }
    }
  } catch {
    /* ignore parse error */
  }

  const prompt = `
Role: You are an AI assistant specialized in determining the correct 'action' for an ItemChange object in a text adventure game, based on narrative context and a potentially malformed ItemChange object.
Valid 'action' types are: "gain", "destroy", "update", "put", "give", "take".

Malformed ItemChange Object:
\`\`\`json
${malformedItemChangeString}
\`\`\`

Narrative Context:
- Log Message: "${logMessage ?? 'Not specified, infer from scene.'}"
- Scene Description: "${sceneDescription ?? 'Not specified, infer from log.'}"
 - Theme Guidance: "${currentTheme.systemInstructionModifier}"

Task: Based on the Log Message, Scene Description, and the 'item' details in the malformed object, determine the most logical 'action' ("gain", "destroy", "update", "put", "give", or "take") that was intended.
- "gain": Player acquired a new item.
- "destroy": Player lost an item or it was consumed.
- "update": An existing item's properties changed.
- "put": A new item appeared somewhere other than the player's inventory.
- "give": An existing item changed holders.
- "take": Same as "give" but may be phrased from the taker's perspective.

Respond ONLY with the single corrected action string.
If no action can be confidently determined, respond with an empty string.`;

  const systemInstruction = `Determine the correct item 'action' ("gain", "destroy", "update", "put", "give", "take") from narrative context and a malformed item object. Respond ONLY with the action string or an empty string if unsure.`;

  return retryAiCall<ItemChange['action']>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.correction.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME, AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = response.text?.trim() ?? null;
      if (aiResponse !== null) {
        const candidateAction = aiResponse.trim().toLowerCase();
        if (['gain', 'destroy', 'update', 'put', 'give', 'take'].includes(candidateAction)) {
          console.warn(`fetchCorrectedItemAction_Service: Returned corrected itemAction `, candidateAction, ".");
          return { result: candidateAction as ItemChange['action'] };
        }
        if (candidateAction === '') {
          console.warn(`fetchCorrectedItemAction_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI indicated no confident action for itemChange: ${malformedItemChangeString}`);
          return { result: null, retry: false };
        }
          console.warn(`fetchCorrectedItemAction_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI returned invalid action "${candidateAction}".`);
      } else {
        console.warn(`fetchCorrectedItemAction_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI call failed for item action. Received: null`);
      }
    } catch (error: unknown) {
      console.error(`fetchCorrectedItemAction_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`, error);
      throw error;
    }
    return { result: null };
  });
};
