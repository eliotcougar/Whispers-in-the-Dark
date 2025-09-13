/**
 * @file services/corrections/item.ts
 * @description Correction helpers for item related data.
 */
import { Item, AdventureTheme, ItemChange, ItemChapter, ItemTag, AddDetailsPayload } from '../../types';
import {
  MAX_RETRIES,
  VALID_ITEM_TYPES_STRING,
  VALID_ACTIONS,
  VALID_ACTIONS_STRING,
  MINIMAL_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { isValidItem } from '../parsers/validation';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { safeParseJson } from '../../utils/jsonUtils';
import { isApiConfigured } from '../geminiClient';
import { retryAiCall } from '../../utils/retry';
import {
  TAG_SYNONYMS,
  createTagHeuristicRegexes,
  normalizeTag,
} from '../../utils/tagSynonyms';
import { VALID_TAGS_STRING, VALID_TAGS } from '../../constants';
import { isValidAddDetailsPayload } from '../parsers/validation';

/**
 * Fetches a corrected item payload from the AI when an itemChange object is malformed.
 */
export const fetchCorrectedItemPayload_Service = async (
  actionType: 'create' | 'change',
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

  const knownUseStructureGuide = `For "knownUses" (array of objects) or "addKnownUse" (single object): Each "Known Use" object REQUIRES:
- "actionName": string
- "promptEffect": string
- "description": string
- "appliesWhenActive?": boolean
- "appliesWhenInactive?": boolean
`;

  const baseItemStructureForPrompt = `{
  "activeDescription?": "string",
  "addKnownUse?": { },
  "chapters"?: [
    {
      "contentLength": number /* Range: 50-500 */,
      "description": "string",
      "heading": "string"
    }
  ]
  "description": "string",
  "holderId": "string",
  "isActive?": boolean,
  "knownUses?": [ ],
  "name": "string",
  "newName?": "string",
  "tags?": ["junk"],
  "type": "(${VALID_ITEM_TYPES_STRING})"
}`;

  let itemContextDescription = '';
  let specificActionInstructions = '';

  if (actionType === 'create') {
    itemContextDescription = 'a new item acquisition';
  specificActionInstructions = `Based *strictly* on Log/Scene and malformed payload:
  - Provide "name", "type", "description" for the created item. These MUST be non-empty.
  - Choose "type" from: ${VALID_ITEM_TYPES_STRING}. The 'type' CANNOT be 'junk'. If the item is junk, add "junk" to its "tags" array and pick a suitable type.
  - Provide "holderId" referencing the correct location or NPC. Use 'player' only if the item goes to the Player's inventory.
  - "isActive" defaults to false. The "tags" array defaults to []. "status effect" items can never have the "junk" tag.
  - For items with type "page", provide a numeric "contentLength" (up to 250 words).
  - "knownUses" is optional.
  - The "newName" and "addKnownUse" fields should NOT be used for "create".
  ${knownUseStructureGuide}`;
  } else {
    itemContextDescription = 'an item update or transformation';
    specificActionInstructions = `Your goal is to correct the 'Malformed Payload' for a "change" action.
The "name" field in the corrected JSON **MUST** be the *original name* of item being updated. If this original name is unclear from malformed payload, infer it from Log/Scene, ideally referencing "${originalItemNameFromMalformed}".
Instructions for "change":
1.  **Simple Update (No Transformation):** If the malformed payload does NOT contain a "newName" AND the Log/Scene context does NOT clearly indicate the item is transforming into something else:
    -   Only include fields ("type", "description", "isActive", "tags", "contentLength", "knownUses", "addKnownUse") if they are being explicitly changed or were present in the original payload.
    -   If "type" or "description" are not provided, the item's existing values will be retained.
    -   If "type" is provided, it must be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the item becomes junk, ensure "tags" includes "junk".
    -   Always include the current "holderId" of the item.
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

  const prompt = `You are an AI assistant tasked with correcting malformed JSON item payloads for a text adventure game.
Reconstruct the 'item' part of an ItemChange object based on the provided context and the malformed data.
Action Type: "${actionType}" (this concerns ${itemContextDescription}).

## Malformed 'item' Payload:
\`\`\`json
${malformedPayloadString}
\`\`\`

## Narrative Context:
- Log Message: "${logMessage ?? 'Not specified, infer from scene.'}"
- Scene Description: "${sceneDescription ?? 'Not specified, infer from log.'}"
- Theme Guidance: "${currentTheme.storyGuidance}"

Required JSON Structure for the corrected 'item' field:
${baseItemStructureForPrompt}

Specific Instructions for action "${actionType}":
${specificActionInstructions}

Respond ONLY with the single, complete, corrected JSON object for the 'item' field.`;

  const systemInstruction = `Correct JSON item payloads based on the provided structure, context, and specific instructions for the action type. Adhere strictly to the JSON format. Preserve the original intent of the item change if discernible. CRITICAL: Ensure the 'type' field is never 'junk'; use the 'tags' array with "junk" and a valid type instead.`;

  return retryAiCall<Item>(async attempt => {
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
      const jsonStr = response.text ?? '';
      const aiResponse = safeParseJson<Item>(jsonStr);
      if (aiResponse && isValidItem(aiResponse, actionType === 'create' ? 'create' : 'change')) {
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
      if (typeof rawAction === 'string' && VALID_ACTIONS.includes(rawAction as ItemChange['action'])) {
        return rawAction as ItemChange['action'];
      }
    }
  } catch {
    /* ignore parse error */
  }

  const prompt = `You are an AI assistant specialized in determining the correct 'action' for an ItemChange object in a text adventure game, based on narrative context and a potentially malformed ItemChange object.
Valid 'action' types are: ${VALID_ACTIONS_STRING}.

Malformed ItemChange Object:
\`\`\`json
${malformedItemChangeString}
\`\`\`

Narrative Context:
- Log Message: "${logMessage ?? 'Not specified, infer from scene.'}"
- Scene Description: "${sceneDescription ?? 'Not specified, infer from log.'}"
- Theme Guidance: "${currentTheme.storyGuidance}"

Task: Based on the Log Message, Scene Description, and the 'item' details in the malformed object, determine the most logical 'action' ("create", "destroy", "change", "addDetails", or "move") that was intended.
- "create": A new item appeared.
- "destroy": Player lost an item or it was consumed.
- "change": An existing item's properties changed.
- "addDetails": A new chapter was added to a book item.
- "move": An existing item changed holders or location.

Respond ONLY with the single corrected action string.
If no action can be confidently determined, respond with an empty string.`;

  const systemInstruction = `Determine the correct item 'action' (${VALID_ACTIONS_STRING}) from narrative context and a malformed item object. Respond ONLY with the action string or an empty string if unsure.`;

  return retryAiCall<ItemChange['action']>(async attempt => {
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
        const candidateAction = aiResponse.trim().toLowerCase();
        if (VALID_ACTIONS.includes(candidateAction as ItemChange['action'])) {
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

export const fetchCorrectedItemTag_Service = async (
  proposedTag: string,
  itemName: string,
  itemDescription: string,
  currentTheme: AdventureTheme,
): Promise<ItemTag | null> => {
  const direct = normalizeTag(proposedTag);
  if (direct) return direct;

  const heuristics = createTagHeuristicRegexes();
  for (const [regex, tag] of heuristics) {
    if (
      regex.test(proposedTag) ||
      regex.test(itemName) ||
      regex.test(itemDescription)
    ) {
      return tag;
    }
  }

  if (!isApiConfigured()) {
    console.error('fetchCorrectedItemTag_Service: API Key not configured.');
    return null;
  }

  const prompt = `Resolve an ambiguous item tag to one of the valid tags.
Candidate tag: "${proposedTag}"
Item name: "${itemName}"
Description: "${itemDescription}"
Theme Guidance: "${currentTheme.storyGuidance}"
Valid tags: ${VALID_TAGS_STRING}
Respond ONLY with the single best tag.`;

  const systemInstruction = `Map ambiguous item tag synonyms to canonical tags. Choose from: ${VALID_TAGS_STRING}.`;

  return retryAiCall<ItemTag>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const aiResponse = response.text?.trim();
      if (aiResponse) {
        const cleaned = aiResponse.replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
        const mapped = TAG_SYNONYMS[cleaned] ?? cleaned;
        if ((VALID_TAGS as ReadonlyArray<string>).includes(mapped as ItemTag)) {
          return { result: mapped as ItemTag };
        }
      }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedItemTag_Service error (Attempt ${String(attempt + 1)}/${String(
          MAX_RETRIES + 1,
        )}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

/**
 * Generates additional chapters for a book item when fewer than MIN_BOOK_CHAPTERS exist.
 */
export const fetchAdditionalBookChapters_Service = async (
  bookTitle: string,
  bookDescription: string,
  existingHeadings: Array<string>,
  countNeeded: number,
): Promise<Array<ItemChapter> | null> => {
  if (!isApiConfigured()) {
    console.error('fetchAdditionalBookChapters_Service: API Key not configured.');
    return null;
  }
  if (countNeeded <= 0) return [];

  const list = existingHeadings.map(h => `- ${h}`).join('\n');
  const prompt = `You are an AI assistant adding missing chapters to a book.
Book Title: "${bookTitle}"
Description: "${bookDescription}"
Existing Chapter Headings:\n${list}

Task: Provide ${String(countNeeded)} additional chapter objects as JSON array. Each object must have "heading", "description", and "contentLength" (50-200).`;

  const systemInstruction = `Return ONLY the JSON array of ${String(countNeeded)} chapter objects.`;

  return retryAiCall<Array<ItemChapter>>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [MINIMAL_MODEL_NAME],
        prompt,
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: CORRECTION_TEMPERATURE,
        label: 'Corrections',
      });
      const jsonStr = response.text ?? '';
      const parsed = safeParseJson<Array<ItemChapter>>(jsonStr);
      if (Array.isArray(parsed) && parsed.every(ch => typeof ch.heading === 'string')) {
        return { result: parsed };
      }
      console.warn(
        `fetchAdditionalBookChapters_Service (Attempt ${String(attempt + 1)}/${String(
          MAX_RETRIES + 1,
        )}): invalid response`,
        parsed,
      );
    } catch (error: unknown) {
      console.error(
        `fetchAdditionalBookChapters_Service error (Attempt ${String(attempt + 1)}/${String(
          MAX_RETRIES + 1,
        )}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

/**
 * Attempts to correct an addDetails payload when inventory AI returns a malformed object.
 */
export const fetchCorrectedAddDetailsPayload_Service = async (
  malformedPayloadString: string,
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  currentTheme: AdventureTheme,
): Promise<AddDetailsPayload | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedAddDetailsPayload_Service: API Key not configured.');
    return null;
  }

  const prompt = `You are an AI assistant fixing a malformed addDetails JSON object for a text adventure game.

Malformed Payload:
\`\`\`json
${malformedPayloadString}
\`\`\`

Log Message: "${logMessage ?? 'Not specified'}"
Scene Description: "${sceneDescription ?? 'Not specified'}"
Theme Guidance: "${currentTheme.storyGuidance}"

Task: Provide ONLY the corrected JSON object with fields { "id": string, "name": string, "type": (${VALID_ITEM_TYPES_STRING}), "knownUses"?, "tags"?, "chapters"? }.`;

  const systemInstruction = 'Return only the corrected addDetails JSON object.';

  return retryAiCall<AddDetailsPayload>(async attempt => {
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
      const jsonStr = response.text ?? '';
      const parsed = safeParseJson<AddDetailsPayload>(jsonStr);
      if (parsed && isValidAddDetailsPayload(parsed)) {
        return { result: parsed };
      }
      console.warn(
        `fetchCorrectedAddDetailsPayload_Service (Attempt ${String(attempt + 1)}/${String(
          MAX_RETRIES + 1,
        )}): invalid response`,
        parsed,
      );
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedAddDetailsPayload_Service error (Attempt ${String(attempt + 1)}/${String(
          MAX_RETRIES + 1,
        )}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
