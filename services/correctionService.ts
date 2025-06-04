
/**
 * @file correctionService.ts
 * @description Helper utilities for correcting malformed AI responses.
 */
import { Item, ItemType, AdventureTheme, Character, DialogueTurnResponsePart, DialogueSetupPayload, ItemChange, MapNode } from '../types'; // Changed Place to MapNode
import { AUXILIARY_MODEL_NAME, MINIMAL_MODEL_NAME, MAX_RETRIES, VALID_ITEM_TYPES_STRING } from '../constants';
import { ai } from './geminiClient';
import { isValidItem, isDialogueSetupPayloadStructurallyValid, isValidNameDescAliasesPair } from './validationUtils';
import { formatKnownPlacesForPrompt, formatKnownCharactersForPrompt } from '../utils/promptFormatters';

const CORRECTION_TEMPERATURE = 0.75;

/**
 * Defines the expected structure for corrected character details from the AI.
 */
export interface CorrectedCharacterDetails {
  description: string;
  aliases: string[];
  presenceStatus: Character['presenceStatus'];
  lastKnownLocation: string | null;
  preciseLocation: string | null;
}

/**
 * Makes a single AI call for correction purposes (expecting JSON response) and parses the JSON response.
 * Uses AUXILIARY_MODEL_NAME.
 * @param prompt The full prompt string for the AI.
 * @param systemInstruction The system instruction string for the AI.
 * @returns A promise that resolves to the parsed JSON object from the AI, or null if the API call or parsing fails for this single attempt.
 */
const callCorrectionAI = async (
  prompt: string,
  systemInstruction: string
): Promise<any | null> => {
  try {
    const response = await ai.models.generateContent({
      model: AUXILIARY_MODEL_NAME, // Will now use gemini-2.5-flash-preview-04-17
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: CORRECTION_TEMPERATURE,
        // Omit thinkingConfig for higher quality (default enabled)
      }
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
    return null;
  }
};

/**
 * Makes a single AI call for correction purposes (expecting simple string response) using MINIMAL_MODEL_NAME.
 * Concatenates systemInstruction with prompt as MINIMAL_MODEL_NAME does not support a separate systemInstruction field.
 * @param prompt The full prompt string for the AI.
 * @param systemInstruction The system instruction string for the AI, which will be prepended to the prompt.
 * @returns A promise that resolves to the trimmed text string from the AI, or null if the API call fails.
 */
const callMinimalCorrectionAI = async (
  prompt: string,
  systemInstruction: string
): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.error("callMinimalCorrectionAI: API Key not configured.");
    return null;
  }
  try {
    const fullPrompt = `${systemInstruction}\n\n${prompt}`;
    const response = await ai.models.generateContent({
      model: MINIMAL_MODEL_NAME, // Will now use gemini-2.5-flash-preview-04-17
      contents: fullPrompt,
      config: {
        temperature: CORRECTION_TEMPERATURE,
        // Omit thinkingConfig for higher quality (default enabled)
        // No responseMimeType needed, expecting text.
        // No separate systemInstruction for this model type (though gemini-2.5-flash-preview-04-17 does support it if used directly)
      }
    });
    return response.text?.trim() ?? null;
  } catch (error) {
    console.error(`callMinimalCorrectionAI: Error during single AI call for prompt starting with "${prompt.substring(0,100)}...":`, error);
    return null;
  }
};


/**
 * Fetches corrected or inferred details for a newly mentioned character from the AI.
 * Implements retry logic based on successful validation of the response.
 * @param {string} characterName The name of the character to get details for.
 * @param {string | undefined} logMessage Optional log message context.
 * @param {string | undefined} sceneDescription Optional scene description context.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @param {MapNode[]} allRelevantMapNodes Array of known map nodes (main nodes) in the current theme for contextual awareness.
 * @returns {Promise<CorrectedCharacterDetails | null>} A promise that resolves to CorrectedCharacterDetails or null if correction fails after all retries.
 */
export const fetchCorrectedCharacterDetails_Service = async (
  characterName: string,
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  currentTheme: AdventureTheme,
  allRelevantMapNodes: MapNode[] 
): Promise<CorrectedCharacterDetails | null> => {
  if (!process.env.API_KEY) {
    console.error(`fetchCorrectedCharacterDetails_Service: API Key not configured. Cannot fetch details for "${characterName}".`);
    return null;
  }

  const knownPlacesString = allRelevantMapNodes.length > 0
    ? "Known map locations in this theme: " + formatKnownPlacesForPrompt(allRelevantMapNodes, true)
    : "No specific map locations are currently known for this theme.";

  const prompt = `
Role: You are an AI assistant generating detailed JSON objects for new game characters.
Task: Provide a suitable description, aliases, presenceStatus, lastKnownLocation, and preciseLocation for a character. Information MUST be derived *strictly* from the provided context.

Character Name: "${characterName}"

Context:
- Log Message (how they appeared/what they're doing): "${logMessage || "Not specified, infer from scene."}"
- Scene Description (where they appeared/are relevant): "${sceneDescription || "Not specified, infer from log."}"
- ${knownPlacesString}
- Theme Guidance (influences character style/role): "${currentTheme.systemInstructionModifier || "General adventure theme."}"

Respond ONLY in JSON format with the following structure:
{
  "description": "string (A detailed, engaging description fitting the scene and theme. MUST be non-empty.)",
  "aliases": ["string"], /* Optional. Can be empty [] if no aliases are apparent from context. */
  "presenceStatus": "nearby" | "distant" | "companion" | "unknown", /* Infer based on context. MUST be non-empty. */
  "lastKnownLocation": "string | null (General location if 'distant' or 'unknown'. Can be a known Map Node name or descriptive. Null otherwise or if truly unknown from context.)",
  "preciseLocation": "string | null (Specific location/activity in scene if 'nearby' or 'companion'. Max ~50 chars. Null otherwise.)"
}

Constraints:
- 'description' and 'presenceStatus' are REQUIRED and must be non-empty.
- If 'presenceStatus' is 'nearby' or 'companion', 'preciseLocation' MUST be a descriptive string derived from context; 'lastKnownLocation' can be null or a broader area.
- If 'presenceStatus' is 'distant' or 'unknown', 'preciseLocation' MUST be null; 'lastKnownLocation' should describe general whereabouts or be 'Unknown' if context doesn't specify.
`;

  const systemInstructionForFix = `You generate detailed JSON objects for new game characters based on narrative context. Provide description, aliases, presenceStatus, lastKnownLocation, and preciseLocation. Adhere strictly to the JSON format and field requirements. Derive all information strictly from the provided context.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedDetails = await callCorrectionAI(prompt, systemInstructionForFix); // Uses JSON-expecting call
    if (
      correctedDetails &&
      typeof correctedDetails.description === 'string' && correctedDetails.description.trim() !== '' &&
      Array.isArray(correctedDetails.aliases) && correctedDetails.aliases.every((a: any) => typeof a === 'string') &&
      typeof correctedDetails.presenceStatus === 'string' && ['distant', 'nearby', 'companion', 'unknown'].includes(correctedDetails.presenceStatus) &&
      (correctedDetails.lastKnownLocation === null || typeof correctedDetails.lastKnownLocation === 'string') &&
      (correctedDetails.preciseLocation === null || typeof correctedDetails.preciseLocation === 'string') &&
      !((correctedDetails.presenceStatus === 'nearby' || correctedDetails.presenceStatus === 'companion') && correctedDetails.preciseLocation === null && correctedDetails.preciseLocation !== "") &&
      !((correctedDetails.presenceStatus === 'distant' || correctedDetails.presenceStatus === 'unknown') && correctedDetails.preciseLocation !== null)
    ) {
      return correctedDetails as CorrectedCharacterDetails;
    } else {
      console.warn(`fetchCorrectedCharacterDetails_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected details for "${characterName}" invalid or incomplete. Response:`, correctedDetails);
      if (attempt === MAX_RETRIES) return null;
    }
  }
  return null;
};

/**
 * Fetches a corrected item payload from the AI when an itemChange object is malformed.
 * Implements retry logic based on successful validation of the response.
 * @param {"gain" | "update"} actionType The type of item action ("gain" or "update").
 * @param {string | undefined} logMessage Optional log message context.
 * @param {string | undefined} sceneDescription Optional scene description context.
 * @param {string} malformedPayloadString The stringified malformed item payload.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @returns {Promise<Item | null>} A promise that resolves to a corrected Item object or null if correction fails after all retries.
 */
export const fetchCorrectedItemPayload_Service = async (
  actionType: "gain" | "update",
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  malformedPayloadString: string,
  currentTheme: AdventureTheme
): Promise<Item | null> => {
  if (!process.env.API_KEY) {
    console.error(`fetchCorrectedItemPayload_Service: API Key not configured. Cannot correct item payload for action "${actionType}".`);
    return null;
  }

  let originalItemNameFromMalformed = "Not specified or unparseable from malformed payload";
  try {
    const malformedObj = JSON.parse(malformedPayloadString);
    if (malformedObj && typeof malformedObj.name === 'string') {
      originalItemNameFromMalformed = `"${malformedObj.name}"`;
    }
  } catch (e) { /* Ignore parse error of malformed string, use default message */ }

  const knownUseStructureGuide = `
For "knownUses" (array of objects) or "addKnownUse" (single object): Each "KnownUse" object REQUIRES:
- "actionName": string (User-facing button text, e.g., "Light Torch").
- "promptEffect": string (CRITICAL: Non-empty text sent to AI on use, defining game effect, e.g., "Player lights the torch.").
- "description": string (Player hint/tooltip, e.g., "Provides light.").
- "appliesWhenActive?": boolean (Optional: Use shown if item.isActive is true).
- "appliesWhenInactive?": boolean (Optional: Use shown if item.isActive is false/undefined).
If neither appliesWhen... field is given, use always shown. If both, applies if (isActive AND appliesWhenActive) OR (!isActive AND appliesWhenInactive).
Example: 'Torch' may have knownUses:
  { "actionName": "Light Torch", "promptEffect": "Player lights torch.", description: "Light the torch.", "appliesWhenInactive": true }
  { "actionName": "Extinguish Torch", "promptEffect": "Player extinguishes torch.", description: "Extinguish the torch.", "appliesWhenActive": true }
`;

  const baseItemStructureForPrompt = `
{
  "name": "string", /* REQUIRED. For "update", this MUST be the ORIGINAL name of the item being changed. */
  "type": "(${VALID_ITEM_TYPES_STRING})", /* For "gain" action, or "update" action with "newName" (transformation), this is REQUIRED. For a simple "update" action without "newName", this is OPTIONAL (original type is inherited if not provided). IMPORTANT: The 'type' field CANNOT be 'junk'. If the item is junk, choose an appropriate type from the list (e.g., 'single-use' for discarded debris) and set 'isJunk: true' in this payload. */
  "description": "string", /* For "gain" action, or "update" action with "newName" (transformation), this is REQUIRED and must be non-empty. For simple "update" without "newName", this is OPTIONAL (original description is inherited if not provided). */
  "activeDescription?": "string", /* Optional. Description when item is active. */
  "isActive?": boolean, /* Optional. Defaults to false if not provided. */
  "isJunk?": boolean, /* Optional. Defaults to false if not provided. 'status effect' items are NEVER junk. Set this to true if the item is considered junk. */
  "knownUses?": [ /* Optional. Array of KnownUse objects. ${knownUseStructureGuide} */ ],
  /* --- Fields primarily for "update" action --- */
  "newName?": "string", /* Optional. If provided for "update", it indicates a transformation. 'type' and 'description' MUST then describe the NEW item. */
  "addKnownUse?": { /* Optional. Single KnownUse object to add/update. ${knownUseStructureGuide} */ }
}`;

  let itemContextDescription = "";
  let specificActionInstructions = "";

  if (actionType === "gain") {
    itemContextDescription = "a new item acquisition";
    specificActionInstructions = `Based *strictly* on Log/Scene and malformed payload:
- Provide "name", "type", "description" for the gained item. These MUST be non-empty.
- Choose "type" from: ${VALID_ITEM_TYPES_STRING}. CRITICALLY IMPORTANT: The 'type' CANNOT be 'junk'. If the item is junk, set 'isJunk: true' in this payload and pick a suitable type from the list (e.g., 'single-use').
- "isActive" defaults to false if not specified. "isJunk" defaults to false if not specified (but remember 'status effect' items are never junk).
- "knownUses" is optional.
- The "newName" and "addKnownUse" fields of the Item object should NOT be used for "gain".
${knownUseStructureGuide}`;
  } else if (actionType === "update") {
    itemContextDescription = "an item update or transformation";
    specificActionInstructions = `Your goal is to correct the 'Malformed Payload' for an "update" action.
The "name" field in the corrected JSON **MUST** be the *original name* of item being updated. If this original name is unclear from malformed payload, infer it from Log/Scene, ideally referencing "${originalItemNameFromMalformed}".

Instructions for "update":
1.  **Simple Update (No Transformation):** If the malformed payload does NOT contain a "newName" AND the Log/Scene context does NOT clearly indicate the item is transforming into something else:
    -   Only include fields ("type", "description", "isActive", "isJunk", "knownUses", "addKnownUse") in the corrected JSON if they are being explicitly changed or were present (even if malformed) in the original payload.
    -   If "type" or "description" are not provided in the corrected JSON, the item's existing values for these fields will be retained by the game.
    -   If "type" is provided, it must be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the item becomes junk, set 'isJunk: true'.
2.  **Transformation (Using "newName"):** If the malformed payload contains a "newName" OR the Log/Scene context clearly indicates the item is transforming:
    -   The corrected payload MUST include the "newName" field with the new name of the item.
    -   The corrected payload MUST also include "type" and "description" fields that accurately describe the *new, transformed item*. "type" MUST be from ${VALID_ITEM_TYPES_STRING} and CANNOT be 'junk'. If the new item is junk, set 'isJunk: true'.
3.  **Known Uses:**
    -   "knownUses" (array): If provided, this *replaces* all existing known uses on the item. An empty array clears all known uses.
    -   "addKnownUse" (object): If provided, this adds a single new known use or updates an existing one with the same actionName.
    -   ${knownUseStructureGuide}
4.  Ensure all present fields are valid. "type" (if present) must be from the valid list. "description" (if present and for a new or transformed item) must be non-empty.`;
  }

  const prompt = `
Role: You are an AI assistant tasked with correcting malformed JSON item payloads for a text adventure game.
Task: Reconstruct the 'item' part of an ItemChange object based on the provided context and the malformed data.
Action Type: "${actionType}" (this concerns ${itemContextDescription}).

Malformed 'item' Payload (the data that needs correction):
\`\`\`json
${malformedPayloadString}
\`\`\`

Narrative Context (use this to infer the correct item details):
- Log Message: "${logMessage || "Not specified, infer from scene."}"
- Scene Description: "${sceneDescription || "Not specified, infer from log."}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || "General adventure theme."}"

Required JSON Structure for the corrected 'item' field:
${baseItemStructureForPrompt}

Specific Instructions for action "${actionType}":
${specificActionInstructions}

Respond ONLY with the single, complete, corrected JSON object for the 'item' field. Do NOT include any extra text, explanations, or markdown formatting around the JSON.
`;

  const systemInstructionForFix = `Correct JSON item payloads based on the provided structure, context, and specific instructions for the action type. Adhere strictly to the JSON format. Preserve the original intent of the item change if discernible. Focus on correcting the malformed data to be valid. CRITICAL: Ensure the 'type' field is never 'junk'; use 'isJunk: true' and a valid type instead.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedItemPayload = await callCorrectionAI(prompt, systemInstructionForFix); // Uses JSON-expecting call
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
 * Fetches a corrected full name for an entity (item, place, character) from the AI,
 * by matching a potentially incorrect name against a list of valid names.
 * Implements retry logic based on successful validation of the response.
 * Uses callMinimalCorrectionAI for simple string output.
 * @param {string} entityTypeToCorrect Type of entity (e.g., "item", "map node name", "character name").
 * @param {string} malformedOrPartialName The potentially incorrect or partial name provided by the AI.
 * @param {string | undefined} contextualLogMessage Optional log message context.
 * @param {string | undefined} contextualSceneDescription Optional scene description context.
 * @param {string[]} validNamesList Array of valid full names for the entity type in the current context.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @returns {Promise<string | null>} A promise that resolves to the corrected name string (from `validNamesList`) or null if no confident match is found or correction fails after all retries.
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
- Log Message: "${contextualLogMessage || "Not specified, infer from scene."}"
- Scene Description: "${contextualSceneDescription || "Not specified, infer from log."}"

List of Valid Names:
${validNamesContext}

Task: Based on the Log Message, Scene Description, and *especially the list of valid names*, determine the correct *full string name* of the ${entityTypeToCorrect} that was most likely intended by the other AI.
Prioritize exact matches or very close variations (e.g., case differences, minor typos, common prefix/suffix issues if they clearly map to a valid name) from the valid list.
Example: If AI provided "Canned Food" and the valid list contains "Canned Food (1 use)", the corrected name is "Canned Food (1 use)".
Example: If AI provided "old key" and the valid list contains "Old Key", the corrected name is "Old Key".

Respond ONLY with the single, corrected ${entityTypeToCorrect} name as a string, chosen *exactly* as it appears in the valid names list.
Do NOT include any other text, explanation, quotes, or markdown formatting.
If no suitable match can be confidently made from the valid names list based on the context, respond with an empty string.
`;

  const systemInstructionForFix = `Your task is to match a malformed ${entityTypeToCorrect} name against a provided list of valid names, using narrative context. Respond ONLY with the best-matched string from the valid list, or an empty string if no confident match is found. Adhere to the theme context: ${currentTheme.systemInstructionModifier || "General interpretation."}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedNameResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix); // Use minimal call

    if (correctedNameResponse !== null) { // Check for null from API call failure
      const correctedName = correctedNameResponse.trim(); // Already a string from callMinimalCorrectionAI
      if (correctedName === '') {
        console.warn(`fetchCorrectedName_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI indicated no match for ${entityTypeToCorrect} "${malformedOrPartialName}" from the valid list.`);
        return null;
      }
      if (validNamesList.includes(correctedName)) {
        console.warn(`fetchCorrectedName_Service: Returned corrected Name "`, correctedName, `".`);
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

/**
 * Fetches a corrected or inferred "localPlace" string from the AI.
 * Implements retry logic based on successful validation of the response.
 * Uses callMinimalCorrectionAI for simple string output.
 * @param {string} currentSceneDescription The current scene description.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @param {MapNode[]} knownMapNodes Array of known map nodes (main nodes) in the current theme.
 * @param {string | null} localTime Current local time.
 * @param {string | null} localEnvironment Current local environment.
 * @returns {Promise<string | null>} A promise that resolves to the corrected localPlace string or null if correction fails after all retries.
 */
export const fetchCorrectedLocalPlace_Service = async (
    currentSceneDescription: string,
    currentTheme: AdventureTheme,
    knownMapNodes: MapNode[], 
    localTime: string | null,
    localEnvironment: string | null
): Promise<string | null> => {
    if (!process.env.API_KEY) {
        console.error("fetchCorrectedLocalPlace_Service: API Key not configured.");
        return null;
    }

    const knownPlacesContextForPrompt = knownMapNodes.length > 0
        ? "Known map locations in this theme that might be relevant: " + formatKnownPlacesForPrompt(knownMapNodes, true)
        : "No specific map locations are currently known for this theme.";

    const prompt = `
Role: You are an AI assistant inferring a player's specific location, which is called "localPlace" in the game.
Task: Determine the most logical "localPlace" based on the provided context. This "localPlace" should be a concise descriptive string.

Context for Inference:
- Current Scene Description (primary source for inference): "${currentSceneDescription}"
- Current Theme: "${currentTheme.name}" (Theme Guidance: ${currentTheme.systemInstructionModifier})
- Current Local Time: "${localTime || "Unknown"}"
- Current Local Environment: "${localEnvironment || "Undetermined"}"
- ${knownPlacesContextForPrompt}

Guidance for "localPlace":
- It's a concise string describing the player's specific position within the scene, relative to one of the Known map locations.
- Examples: "Inside the Old Mill", "Standing before the Crimson Gate", "On the path between Whispering Woods and Crystal Cave".
- It should be logically derived from the Current Scene Description.
- If the location is truly unclear from the scene, use "Undetermined Location".

Respond ONLY with the inferred "localPlace" as a single string. No other text, quotes, or markdown formatting.
Example Response: "Inside the Dusty Mug Tavern"
Example Response: "On a dimly lit path through Whispering Woods"
Example Response: "Undetermined Location"
`;

    const systemInstructionForFix = `Infer a player's "localPlace" based on narrative context. The "localPlace" should be a concise descriptive string. Respond ONLY with the string value.`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const correctedPlaceResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix); // Use minimal call
      if (correctedPlaceResponse !== null && correctedPlaceResponse.trim().length > 0) {
          const correctedPlace = correctedPlaceResponse.trim();
          console.warn(`fetchCorrectedLocalPlace_Service: Returned corrected localPlace "`, correctedPlace, `".`);
          return correctedPlace;
      } else {
          console.warn(`fetchCorrectedLocalPlace_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI call failed for localPlace. Received: null`);
      }
      if (attempt === MAX_RETRIES) return null;
    }
    return null;
};

/**
 * Fetches a corrected "preciseLocation" string for a character (companion or NPC) from the AI.
 * "preciseLocation" describes the character's specific location or activity within the current scene.
 * Implements retry logic based on successful validation of the response.
 * Uses callMinimalCorrectionAI for simple string output.
 * @param {string} characterName The name of the character.
 * @param {string | undefined} logMessage Optional log message context.
 * @param {string | undefined} sceneDescription Optional scene description context.
 * @param {MapNode[]} allRelevantMapNodes Array of known map nodes (main nodes) in the current theme for contextual awareness.
 * @param {string} invalidPreciseLocationPayload The malformed or missing preciseLocation payload string.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @returns {Promise<string | null>} A promise that resolves to the corrected preciseLocation string (max ~50-60 chars) or null if correction fails after all retries.
 */
export const fetchCorrectedCompanionOrNPCLocation_Service = async (
    characterName: string,
    logMessage: string | undefined,
    sceneDescription: string | undefined,
    allRelevantMapNodes: MapNode[], 
    invalidPreciseLocationPayload: string,
    currentTheme: AdventureTheme
): Promise<string | null> => {
    if (!process.env.API_KEY) {
        console.error(`fetchCorrectedCompanionOrNPCLocation_Service: API Key not configured. Cannot correct location for "${characterName}".`);
        return null;
    }

    const knownPlacesString = allRelevantMapNodes.length > 0
        ? "Known map locations in this theme that might be relevant: " + formatKnownPlacesForPrompt(allRelevantMapNodes, true)
        : "No specific map locations are currently known for this theme.";

    const prompt = `
Role: You are an AI assistant tasked with correcting or inferring a character's "preciseLocation".
Character Name: "${characterName}" (This character is currently present in the scene with the player).

"preciseLocation" definition:
- It describes the character's specific location or activity *within the current scene*.
- It MUST be a short, descriptive phrase (ideally under 50 characters, absolute max ~60 characters).
- Examples: "examining the bookshelf", "hiding behind barrels", "next to you", "across the room", "arguing with the guard".

Narrative Context (use this to infer the location/activity):
- Log Message (may describe character's actions): "${logMessage || "Not specified, infer from scene."}"
- Scene Description (primary source for character's current state): "${sceneDescription || "Not specified, infer from log."}"
- ${knownPlacesString}

Malformed or Missing "preciseLocation" data from previous AI: "${invalidPreciseLocationPayload}"

Task: Based *only* on the character's name and the provided narrative context, determine the correct short "preciseLocation" string for this character within the current scene.

Respond ONLY with the corrected "preciseLocation" string. No other text, quotes, or markdown formatting.
Example Response: "examining the ancient map"
Example Response: "near you"
Example Response: If unclear from context, respond with a generic but plausible short phrase like "observing the surroundings" or "standing nearby".
`;

    const systemInstructionForFix = `Infer or correct a character's "preciseLocation" (a short phrase, max ~50-60 chars, describing their in-scene activity/position) from narrative context and potentially malformed input. Respond ONLY with the string value. Adhere to theme context: ${currentTheme.systemInstructionModifier || "General interpretation."}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const correctedLocationResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix); // Use minimal call
      if (correctedLocationResponse !== null) { // Check for null from API call failure
          const correctedLocation = correctedLocationResponse.trim(); // Already a string
          if (correctedLocation.length > 0 && correctedLocation.length <= 60) {
              console.warn(`fetchCorrectedCompanionOrNPCLocation_Service: Returned corrected NPC Location "`, correctedLocation, `".`);
              return correctedLocation;
          } else {
              console.warn(`fetchCorrectedCompanionOrNPCLocation_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected preciseLocation for "${characterName}" was empty or too long: "${correctedLocation}"`);
          }
      } else {
          console.warn(`fetchCorrectedCompanionOrNPCLocation_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI call failed for preciseLocation of "${characterName}". Received: null`);
      }
      if (attempt === MAX_RETRIES) return null;
    }
    return null;
};


/**
 * Fetches a corrected item action ("gain", "lose", "update") from the AI
 * when the 'action' field of an ItemChange object is missing or malformed.
 * Implements retry logic based on successful validation of the response.
 * Uses callMinimalCorrectionAI for simple string output.
 * @param {string | undefined} logMessage Optional log message context.
 * @param {string | undefined} sceneDescription Optional scene description context.
 * @param {string} malformedItemChangeString The stringified malformed ItemChange object (or just its 'item' part if action was missing).
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @returns {Promise<ItemChange['action'] | null>} A promise that resolves to a corrected action string or null if correction fails after all retries.
 */
export const fetchCorrectedItemAction_Service = async (
    logMessage: string | undefined,
    sceneDescription: string | undefined,
    malformedItemChangeString: string,
    currentTheme: AdventureTheme
): Promise<ItemChange['action'] | null> => {
    if (!process.env.API_KEY) {
        console.error("fetchCorrectedItemAction_Service: API Key not configured. Cannot correct item action.");
        return null;
    }

    const prompt = `
Role: You are an AI assistant specialized in determining the correct 'action' for an ItemChange object in a text adventure game, based on narrative context and a potentially malformed ItemChange object.
Valid 'action' types are: "gain", "lose", "update".

Malformed ItemChange Object (or part of it, 'action' field might be missing or invalid):
\`\`\`json
${malformedItemChangeString}
\`\`\`

Narrative Context (use this to infer the intended action):
- Log Message (describes what happened): "${logMessage || "Not specified, infer from scene."}"
- Scene Description (current situation): "${sceneDescription || "Not specified, infer from log."}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || "General adventure theme."}"

Task: Based on the Log Message, Scene Description, and the 'item' details in the malformed object, determine the most logical 'action' ("gain", "lose", or "update") that was intended.
- "gain": Player acquired a new item.
- "lose": Player lost an item or it was consumed.
- "update": An existing item's properties changed (e.g., description, isActive state, transformed into another item).

Respond ONLY with the single corrected action string (e.g., "gain", "lose", "update").
Do NOT include any other text, explanation, quotes, or markdown formatting.
If no action can be confidently determined, respond with an empty string.
`;

    const systemInstructionForFix = `Determine the correct item 'action' ("gain", "lose", "update") from narrative context and a malformed item object. Respond ONLY with the action string or an empty string if unsure.`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const correctedActionResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix); // Use minimal call
      if (correctedActionResponse !== null) { // Check for null from API call failure
          const action = correctedActionResponse.trim().toLowerCase(); // Already a string
          if (["gain", "lose", "update"].includes(action)) {
              console.warn(`fetchCorrectedItemAction_Service: Returned corrected itemActione "`, action, `".`);
              return action as ItemChange['action'];
          } else if (action === "") {
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

/**
 * Fetches a corrected DialogueSetupPayload from the AI when the original is malformed.
 * Implements retry logic based on successful validation of the response.
 * @param {string | undefined} logMessageContext Log message leading to dialogue.
 * @param {string | undefined} sceneDescriptionContext Scene description when dialogue initiated.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @param {Character[]} allRelevantCharacters All characters known or added this turn.
 * @param {MapNode[]} allRelevantMapNodes All map nodes (main nodes) known or added this turn.
 * @param {Item[]} currentInventory Player's inventory.
 * @param {string} playerGender Player's gender.
 * @param {Partial<DialogueSetupPayload> | any} malformedDialogueSetup The malformed payload.
 * @returns {Promise<DialogueSetupPayload | null>} Corrected payload or null after all retries.
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
        console.error("fetchCorrectedDialogueSetup_Service: API Key not configured.");
        return null;
    }

    const characterContext = formatKnownCharactersForPrompt(allRelevantCharacters, true);
    const placeContext = formatKnownPlacesForPrompt(allRelevantMapNodes, true); 
    const inventoryContext = currentInventory.map(i => i.name).join(', ') || "Empty";
    const malformedString = JSON.stringify(malformedDialogueSetup);

    const prompt = `
Role: You are an AI assistant correcting a malformed 'dialogueSetup' JSON payload for a text adventure game.
Task: Reconstruct the 'dialogueSetup' object based on narrative context and the malformed data.

Malformed 'dialogueSetup' Payload:
\`\`\`json
${malformedString}
\`\`\`

Narrative Context (use this to infer correct dialogue details):
- Log Message (event leading to dialogue): "${logMessageContext || "Not specified"}"
- Scene Description (current situation): "${sceneDescriptionContext || "Not specified"}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || "General adventure theme."}"
- Known/Available Characters for Dialogue: ${characterContext}
- Known Map Locations: ${placeContext}
- Player Inventory: ${inventoryContext}
- Player Gender: "${playerGender}"

Required JSON Structure for corrected 'dialogueSetup':
{
  "participants": ["Character Name 1", "Character Name 2"?, ...], /* REQUIRED. Array of 1+ NPC names. MUST be from 'Known/Available Characters'. DO NOT include Player. */
  "initialNpcResponses": [{ "speaker": "Character Name 1", "line": "Their first line." }, ...], /* REQUIRED. At least one NPC response. 'speaker' MUST be one of "participants". Lines non-empty. */
  "initialPlayerOptions": [ /* REQUIRED. Array of 4-8 distinct, non-empty, first-person initial dialogue choices. LAST option MUST be a way to end dialogue. */ ]
}

Instructions:
1. Identify likely NPC participant(s) from 'Known/Available Characters' based on context.
2. Generate 1-2 engaging initial NPC responses for the identified participant(s).
3. Create 4-8 varied, first-person dialogue options for the player. The LAST option must be a way for the player to politely end the dialogue (e.g., "I should go now.", "Thanks, that's all.").
4. Ensure all fields are present and valid as per the structure.

Respond ONLY with the single, complete, corrected JSON object for 'dialogueSetup'. No extra text or markdown.
`;
    const systemInstructionForFix = `Correct a malformed 'dialogueSetup' JSON payload. Ensure 'participants' are valid NPCs, 'initialNpcResponses' are logical, and 'initialPlayerOptions' are varied with an exit option. Adhere strictly to the JSON format.`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const correctedPayload = await callCorrectionAI(prompt, systemInstructionForFix); // Uses JSON-expecting call
      if (correctedPayload && isDialogueSetupPayloadStructurallyValid(correctedPayload)) {
          return correctedPayload as DialogueSetupPayload;
      } else {
          console.warn(`fetchCorrectedDialogueSetup_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected dialogueSetup payload invalid. Response:`, correctedPayload);
      }
      if (attempt === MAX_RETRIES) return null;
    }
    return null;
};

/**
 * Fetches corrected details for a map node (typically main node) from the AI,
 * when the Map AI might have provided an incomplete payload (e.g., missing description or aliases).
 * This is a fallback.
 * @param {string} malformedMapNodePayloadString Stringified malformed/incomplete map node data.
 * @param {string | undefined} logMessageContext Optional log message context.
 * @param {string | undefined} sceneDescriptionContext Optional scene description context.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @returns {Promise<{ name: string; description: string; aliases?: string[] } | null>} Corrected map node details or null.
 */
export const fetchCorrectedPlaceDetails_Service = async (
  malformedMapNodePayloadString: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme
): Promise<{ name: string; description: string; aliases?: string[] } | null> => {
  if (!process.env.API_KEY) {
    console.error("fetchCorrectedPlaceDetails_Service: API Key not configured.");
    return null;
  }

  let originalPlaceNameFromMalformed = "Not specified or unparseable";
  try {
    const malformedObj = JSON.parse(malformedMapNodePayloadString);
    if (malformedObj && typeof malformedObj.name === 'string') {
      originalPlaceNameFromMalformed = `"${malformedObj.name}"`;
    } else if (typeof malformedMapNodePayloadString === 'string' && !malformedMapNodePayloadString.startsWith('{')) {
        originalPlaceNameFromMalformed = `"${malformedMapNodePayloadString}"`;
    }
  } catch (e) { /* Ignore */ }

  const prompt = `
Role: You are an AI assistant correcting or completing a JSON payload for a map location (MapNode) in a text adventure game. The Map AI was supposed to provide full details but might have failed.
Task: Reconstruct the map location details ("name", "description", "aliases") based on narrative context and potentially incomplete/malformed data.

Malformed/Incomplete Map Location Payload (from Map AI):
\`\`\`json
${malformedMapNodePayloadString}
\`\`\`
(This might just be a name string like ${originalPlaceNameFromMalformed}, or an object missing required fields like 'description' or 'aliases'.)

Narrative Context (use this to infer correct details):
- Log Message (event revealing/describing the location): "${logMessageContext || "Not specified"}"
- Scene Description (current situation): "${sceneDescriptionContext || "Not specified"}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || "General adventure theme."}"

Required JSON Structure for corrected map location details:
{
  "name": "string", /* REQUIRED, non-empty. Infer the location's name. If malformed payload had a name (like ${originalPlaceNameFromMalformed}), prioritize that. */
  "description": "string", /* REQUIRED, non-empty, creative, thematically appropriate description (ideally <300 characters). */
  "aliases": ["string"] /* REQUIRED. Array of alternative names/shorthands (can be empty []). Soft limit of 3-4 aliases. */
}

Instructions:
1. Infer/confirm the "name" of the map location.
2. Generate a non-empty "description".
3. Provide "aliases" as an array of strings (can be empty).
4. Ensure all fields ("name", "description", "aliases") are present and valid.

Respond ONLY with the single, complete, corrected JSON object. No extra text or markdown.
`;
  const systemInstructionForFix = `Correct or complete a JSON payload for a map location. Ensure "name" (string, non-empty), "description" (string, non-empty), and "aliases" (array of strings, can be empty) are provided. Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI(prompt, systemInstructionForFix); // Uses JSON-expecting call
    if (correctedPayload &&
        typeof correctedPayload.name === 'string' && correctedPayload.name.trim() !== '' &&
        typeof correctedPayload.description === 'string' && correctedPayload.description.trim() !== '' &&
        Array.isArray(correctedPayload.aliases) && correctedPayload.aliases.every((a: any) => typeof a === 'string')
    ) {
        return correctedPayload as { name: string; description: string; aliases?: string[] };
    } else {
        console.warn(`fetchCorrectedPlaceDetails_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected map location payload invalid. Response:`, correctedPayload);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};

/**
 * Fetches full MapNode details (description, aliases) for a new main map node name.
 * The provided mapNodePlaceName MUST be used as the 'name' in the output.
 * This is typically called when mapUpdateAI adds a main node with only a name/status.
 * @param {string} mapNodePlaceName The exact name of the new map node. This will be the 'name' in the output.
 * @param {string | undefined} logMessageContext Contextual log message.
 * @param {string | undefined} sceneDescriptionContext Contextual scene description.
 * @param {AdventureTheme} currentTheme The current adventure theme object.
 * @returns {Promise<{ name: string; description: string; aliases?: string[] } | null>} Details or null.
 */
export const fetchFullPlaceDetailsForNewMapNode_Service = async (
  mapNodePlaceName: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme
): Promise<{ name: string; description: string; aliases?: string[] } | null> => {
  if (!process.env.API_KEY) {
    console.error("fetchFullPlaceDetailsForNewMapNode_Service: API Key not configured.");
    return null;
  }

  const prompt = `
Role: You are an AI assistant that generates detailed information for a new game map location (a main MapNode) that has just been added to the game map. The Map AI should have provided these details, but this is a fallback.
Task: Given the name of this new map location and the current narrative context, provide a suitable description and aliases for it. The provided 'Map Location Name to Detail' is fixed and MUST be used as the 'name' in your JSON response.

Map Location Name to Detail: "${mapNodePlaceName}"

Narrative Context (use this to infer description and aliases):
- Log Message (event that might have revealed or led to this location): "${logMessageContext || "Not specified"}"
- Scene Description (current situation): "${sceneDescriptionContext || "Not specified"}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || "General adventure theme."}"

Required JSON Structure:
{
  "name": "${mapNodePlaceName}", /* CRITICAL: This field MUST be exactly "${mapNodePlaceName}" */
  "description": "string", /* REQUIRED, non-empty, creative, thematically appropriate description (ideally <300 characters). */
  "aliases": ["string"] /* REQUIRED. Array of alternative names or common shorthands (can be empty []). Soft limit of 3-4. */
}

Instructions:
1.  The "name" field in your response MUST be exactly "${mapNodePlaceName}". Do not change it.
2.  Generate a compelling, non-empty "description" for "${mapNodePlaceName}" based on the narrative context.
3.  Provide relevant "aliases" for "${mapNodePlaceName}" as an array of strings (can be empty).
4.  Ensure all fields ("name", "description", "aliases") are present and valid.

Respond ONLY with the single, complete JSON object. No extra text or markdown.
`;
  const systemInstructionForFix = `Generate detailed JSON for a new game map location. The 'name' field in the output is predetermined and MUST match the input. Focus on creating a fitting, non-empty description and aliases (array of strings, can be empty). Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI(prompt, systemInstructionForFix); // Uses JSON-expecting call
    if (
      correctedPayload &&
      typeof correctedPayload.name === 'string' && correctedPayload.name === mapNodePlaceName &&
      typeof correctedPayload.description === 'string' && correctedPayload.description.trim() !== '' &&
      Array.isArray(correctedPayload.aliases) && correctedPayload.aliases.every((alias: any) => typeof alias === 'string')
    ) {
      return correctedPayload as { name: string; description: string; aliases?: string[] };
    } else {
      console.warn(`fetchFullPlaceDetailsForNewMapNode_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): Corrected map location payload invalid or name mismatch for "${mapNodePlaceName}". Response:`, correctedPayload);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};
