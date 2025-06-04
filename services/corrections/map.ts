/**
 * @file services/corrections/map.ts
 * @description Correction helpers for map and location related data.
 */
import { AdventureTheme, MapNode } from '../../types';
import { MAX_RETRIES } from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters';
import { callCorrectionAI, callMinimalCorrectionAI } from './base';

/**
 * Infers or corrects the player's current local place string.
 */
export const fetchCorrectedLocalPlace_Service = async (
  currentSceneDescription: string,
  currentTheme: AdventureTheme,
  knownMapNodes: MapNode[],
  localTime: string | null,
  localEnvironment: string | null
): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.error('fetchCorrectedLocalPlace_Service: API Key not configured.');
    return null;
  }

  const knownPlacesContextForPrompt = knownMapNodes.length > 0
    ? 'Known map locations in this theme that might be relevant: ' + formatKnownPlacesForPrompt(knownMapNodes, true)
    : 'No specific map locations are currently known for this theme.';

  const prompt = `
Role: You are an AI assistant inferring a player's specific location, which is called "localPlace" in the game.
Task: Determine the most logical "localPlace" based on the provided context. This "localPlace" should be a concise descriptive string.

Context for Inference:
- Current Scene Description (primary source for inference): "${currentSceneDescription}"
- Current Theme: "${currentTheme.name}" (Theme Guidance: ${currentTheme.systemInstructionModifier})
- Current Local Time: "${localTime || 'Unknown'}"
- Current Local Environment: "${localEnvironment || 'Undetermined'}"
- ${knownPlacesContextForPrompt}

Guidance for "localPlace":
- It's a concise string describing the player's specific position within the scene, relative to one of the Known map locations.
- If the location is truly unclear from the scene, use "Undetermined Location".

Respond ONLY with the inferred "localPlace" as a single string.`;

  const systemInstructionForFix = `Infer a player's "localPlace" based on narrative context. The "localPlace" should be a concise descriptive string. Respond ONLY with the string value.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPlaceResponse = await callMinimalCorrectionAI(prompt, systemInstructionForFix);
    if (correctedPlaceResponse !== null && correctedPlaceResponse.trim().length > 0) {
      const correctedPlace = correctedPlaceResponse.trim();
      console.warn(`fetchCorrectedLocalPlace_Service: Returned corrected localPlace `, correctedPlace, `.`);
      return correctedPlace;
    } else {
      console.warn(`fetchCorrectedLocalPlace_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): AI call failed for localPlace. Received: null`);
    }
    if (attempt === MAX_RETRIES) return null;
  }
  return null;
};

/**
 * Corrects or completes map node details such as description or aliases.
 */
export const fetchCorrectedPlaceDetails_Service = async (
  malformedMapNodePayloadString: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme
): Promise<{ name: string; description: string; aliases?: string[] } | null> => {
  if (!process.env.API_KEY) {
    console.error('fetchCorrectedPlaceDetails_Service: API Key not configured.');
    return null;
  }

  let originalPlaceNameFromMalformed = 'Not specified or unparseable';
  try {
    const malformedObj = JSON.parse(malformedMapNodePayloadString);
    if (malformedObj && typeof malformedObj.name === 'string') {
      originalPlaceNameFromMalformed = `"${malformedObj.name}"`;
    } else if (typeof malformedMapNodePayloadString === 'string' && !malformedMapNodePayloadString.startsWith('{')) {
      originalPlaceNameFromMalformed = `"${malformedMapNodePayloadString}"`;
    }
  } catch {
    /* ignore */
  }

  const prompt = `
Role: You are an AI assistant correcting or completing a JSON payload for a map location (MapNode) in a text adventure game. The Map AI was supposed to provide full details but might have failed.
Task: Reconstruct the map location details ("name", "description", "aliases") based on narrative context and potentially incomplete/malformed data.

Malformed/Incomplete Map Location Payload (from Map AI):
\`\`\`json
${malformedMapNodePayloadString}
\`\`\`
(This might just be a name string like ${originalPlaceNameFromMalformed}, or an object missing required fields like 'description' or 'aliases'.)

Narrative Context:
- Log Message: "${logMessageContext || 'Not specified'}"
- Scene Description: "${sceneDescriptionContext || 'Not specified'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Required JSON Structure for corrected map location details:
{
  "name": "string",
  "description": "string",
  "aliases": ["string"]
}

Respond ONLY with the single, complete, corrected JSON object.`;

  const systemInstructionForFix = `Correct or complete a JSON payload for a map location. Ensure "name" (string, non-empty), "description" (string, non-empty), and "aliases" (array of strings, can be empty) are provided. Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI(prompt, systemInstructionForFix);
    if (
      correctedPayload &&
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
 * Fetches full details for a newly introduced map node name.
 */
export const fetchFullPlaceDetailsForNewMapNode_Service = async (
  mapNodePlaceName: string,
  logMessageContext: string | undefined,
  sceneDescriptionContext: string | undefined,
  currentTheme: AdventureTheme
): Promise<{ name: string; description: string; aliases?: string[] } | null> => {
  if (!process.env.API_KEY) {
    console.error('fetchFullPlaceDetailsForNewMapNode_Service: API Key not configured.');
    return null;
  }

  const prompt = `
Role: You are an AI assistant that generates detailed information for a new game map location (a main MapNode) that has just been added to the game map. The Map AI should have provided these details, but this is a fallback.
Task: Given the name of this new map location and the current narrative context, provide a suitable description and aliases for it. The provided 'Map Location Name to Detail' is fixed and MUST be used as the 'name' in your JSON response.

Map Location Name to Detail: "${mapNodePlaceName}"

Narrative Context:
- Log Message: "${logMessageContext || 'Not specified'}"
- Scene Description: "${sceneDescriptionContext || 'Not specified'}"
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Required JSON Structure:
{
  "name": "${mapNodePlaceName}",
  "description": "string",
  "aliases": ["string"]
}

Respond ONLY with the single, complete JSON object.`;

  const systemInstructionForFix = `Generate detailed JSON for a new game map location. The 'name' field in the output is predetermined and MUST match the input. Focus on creating a fitting, non-empty description and aliases (array of strings, can be empty). Adhere strictly to the JSON format.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const correctedPayload = await callCorrectionAI(prompt, systemInstructionForFix);
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
