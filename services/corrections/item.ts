/**
 * @file services/corrections/item.ts
 * @description Correction helpers for item related data.
 */
import { Item, AdventureTheme, ItemChange } from '../../types';
import { MAX_RETRIES, VALID_ITEM_TYPES_STRING } from '../../constants';
import { isValidItem } from '../parsers/validation';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters';
import { callCorrectionAI, callMinimalCorrectionAI } from './base';

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
  if (!process.env.API_KEY) {
    console.error(`fetchCorrectedItemPayload_Service: API Key not configured. Cannot correct item payload for action "${actionType}".`);
    return null;
  }

  let originalItemNameFromMalformed = 'Not specified or unparseable from malformed payload';
  try {
    const malformedObj = JSON.parse(malformedPayloadString);
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
  "isJunk?": boolean,
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
- Choose "type" from: ${VALID_ITEM_TYPES_STRING}. The 'type' CANNOT be 'junk'. If the item is junk, set 'isJunk: true' and pick a suitable type.
- "isActive" defaults to false. "isJunk" defaults to false (but 'status effect' items are never junk).
- "knownUses" is optional.
- The "newName" and "addKnownUse" fields should NOT be used for "gain".
${knownUseStructureGuide}`;
  } else {
    itemContextDescription = 'an item update or transformation';
    specificActionInstructions = `Your goal is to correct the 'Malformed Payload' for an "update" action.
The "name" field in the corrected JSON **MUST** be the *original name* of item being updated. If this original name is unclear from malformed payload, infer it from Log/Scene, ideally referencing "${originalItemNameFromMalformed}".
Instructions for "update":
1.  **Simple Update (No Transformation):** If the malformed payload does NOT contain a "newName" AND the Log/Scene context does NOT clearly indicate the item is transforming into something else:
    -   Only include fields ("type", "description", "isActive", "isJunk", "knownUses", "addKnownUse") if they are being explicitly changed or were present in the original payload.
    -   If "type" or "description" are not provided, the item's existing values will be retained.
    -   If "type" is provided, it must be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the item becomes junk, set 'isJunk: true'.
2.  **Transformation (Using "newName"):** If the malformed payload contains a "newName" OR the context clearly indicates a transformation:
    -   The corrected payload MUST include the "newName" field.
    -   The corrected payload MUST also include "type" and "description" that describe the *new, transformed item*.
    -   "type" MUST be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the new item is junk, set 'isJunk: true'.
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
- Log Message: "${logMessage || 'Not specified, infer from scene.'}"
- Scene Description: "${sceneDescription || 'Not specified, infer from log.'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Required JSON Structure for the corrected 'item' field:
${baseItemStructureForPrompt}

Specific Instructions for action "${actionType}":
${specificActionInstructions}

Respond ONLY with the single, complete, corrected JSON object for the 'item' field.`;

  const systemInstructionForFix = `Correct JSON item payloads based on the provided structure, context, and specific instructions for the action type. Adhere strictly to the JSON format. Preserve the original intent of the item change if discernible. CRITICAL: Ensure the 'type' field is never 'junk'; use 'isJunk: true' and a valid type instead.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedItemPayload = await callCorrectionAI(prompt, systemInstructionForFix);
    if (correctedItemPayload && isValidItem(correctedItemPayload, actionType === 'gain' ? 'gain' : 'update')) {
      return correctedItemPayload as Item;
    } else {
      console.warn(`fetchCorrectedItemPayload_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected '${actionType}' payload invalid after validation. Response:`, correctedItemPayload);
      if (attempt === MAX_RETRIES) return null;
    }
  }
  return null;
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
  if (!process.env.API_KEY) {
    console.error('fetchCorrectedItemAction_Service: API Key not configured. Cannot correct item action.');
    return null;
  }

  const prompt = `
Role: You are an AI assistant specialized in determining the correct 'action' for an ItemChange object in a text adventure game, based on narrative context and a potentially malformed ItemChange object.
Valid 'action' types are: "gain", "lose", "update".

Malformed ItemChange Object:
\`\`\`json
${malformedItemChangeString}
\`\`\`

Narrative Context:
- Log Message: "${logMessage || 'Not specified, infer from scene.'}"
- Scene Description: "${sceneDescription || 'Not specified, infer from log.'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Task: Based on the Log Message, Scene Description, and the 'item' details in the malformed object, determine the most logical 'action' ("gain", "lose", or "update") that was intended.
- "gain": Player acquired a new item.
- "lose": Player lost an item or it was consumed.
- "update": An existing item's properties changed.

Respond ONLY with the single corrected action string.
If no action can be confidently determined, respond with an empty string.`;

  const systemInstructionForFix = `Determine the correct item 'action' ("gain", "lose", "update") from narrative context and a malformed item object. Respond ONLY with the action string or an empty string if unsure.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedActionResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix);
    if (correctedActionResponse !== null) {
      const action = correctedActionResponse.trim().toLowerCase();
      if (['gain', 'lose', 'update'].includes(action)) {
        console.warn(`fetchCorrectedItemAction_Service: Returned corrected itemAction `, action, `.`);
        return action as ItemChange['action'];
      } else if (action === '') {
        console.warn(`fetchCorrectedItemAction_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI indicated no confident action for itemChange: ${malformedItemChangeString}`);
        return null;
      } else {
        console.warn(`fetchCorrectedItemAction_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI returned invalid action "${action}".`);
      }
    } else {
      console.warn(`fetchCorrectedItemAction_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI call failed for item action. Received: null`);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};
