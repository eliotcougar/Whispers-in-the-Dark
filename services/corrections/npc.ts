/**
 * @file services/corrections/npc.ts
 * @description Correction helpers for NPC related data.
 */
import { AdventureTheme, NPC, MapNode } from '../../types';
import {
  MAX_RETRIES,
  VALID_PRESENCE_STATUS_VALUES,
  VALID_PRESENCE_STATUS_VALUES_STRING,
  DEFAULT_NPC_ATTITUDE,
  MINIMAL_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
} from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';
import { CORRECTION_TEMPERATURE, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { safeParseJson } from '../../utils/jsonUtils';
import { isApiConfigured } from '../geminiClient';
import { retryAiCall } from '../../utils/retry';

/** Structure returned when correcting NPC details. */
export interface CorrectedNPCDetails {
  description: string;
  aliases: Array<string>;
  presenceStatus: NPC['presenceStatus'];
  lastKnownLocation: string | null;
  preciseLocation: string | null;
  attitudeTowardPlayer?: string | null;
  knowsPlayerAs?: Array<string>;
}

/**
 * Fetches corrected or inferred details for a newly mentioned NPC from the AI.
 */
export const fetchCorrectedNPCDetails_Service = async (
  npcName: string,
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  currentTheme: AdventureTheme,
  allRelevantMapNodes: Array<MapNode>
): Promise<CorrectedNPCDetails | null> => {
  if (!isApiConfigured()) {
    console.error(`fetchCorrectedNPCDetails_Service: API Key not configured. Cannot fetch details for "${npcName}".`);
    return null;
  }

  const knownPlacesString = allRelevantMapNodes.length > 0
    ? 'Known map locations in this theme: ' + formatKnownPlacesForPrompt(allRelevantMapNodes, true)
    : 'No specific map locations are currently known for this theme.';

  const prompt = `
You are an AI assistant generating detailed JSON objects for new NPCs.
Provide a suitable description, aliases, presenceStatus, lastKnownLocation, and preciseLocation for a character. Information MUST be derived *strictly* from the provided context.

NPC Name: "${npcName}"

Context:
- Log Message (how they appeared/what they're doing): "${logMessage ?? 'Not specified, infer from scene.'}"
- Scene Description (where they appeared/are relevant): "${sceneDescription ?? 'Not specified, infer from log.'}"
- ${knownPlacesString}
- Theme Guidance (influences NPC style/role): "${currentTheme.storyGuidance}"

Respond ONLY in JSON format with the following structure:
{
  "aliases": ["string"],
  "description": "string (A detailed, engaging description fitting the scene and theme. MUST be non-empty.)",
  "lastKnownLocation": "string | null",
  "preciseLocation": "string | null",
  "presenceStatus": ${VALID_PRESENCE_STATUS_VALUES_STRING},
  "attitudeTowardPlayer": "string",
  "knowsPlayerAs": { "type": "array", "items": { "type": "string" } }
}

Constraints:
- 'description', 'presenceStatus', and 'attitudeTowardPlayer' are REQUIRED and must be non-empty.
- If 'presenceStatus' is 'nearby' or 'companion', 'preciseLocation' MUST be a descriptive string derived from context; 'lastKnownLocation' can be null or a broader area.
- If 'presenceStatus' is 'distant' or 'unknown', 'preciseLocation' MUST be null; 'lastKnownLocation' should describe general whereabouts or be 'Unknown' if context doesn't specify.
- Provide all names or aliases the NPC uses for the player in 'knowsPlayerAs'. Use an empty array if none are known.
`;

  const systemInstruction = `You generate detailed JSON objects for new NPCs based on narrative context. Provide description, aliases, presenceStatus, attitudeTowardPlayer, knowsPlayerAs, lastKnownLocation, and preciseLocation. Adhere strictly to the JSON format and field requirements. Derive all information strictly from the provided context.`;

  return retryAiCall<CorrectedNPCDetails>(async attempt => {
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
      const aiResponse = safeParseJson<CorrectedNPCDetails>(response.text ?? '');
      if (
        aiResponse &&
        typeof aiResponse.description === 'string' &&
        aiResponse.description.trim() !== '' &&
        Array.isArray(aiResponse.aliases) &&
        aiResponse.aliases.every((a): a is string => typeof a === 'string') &&
        typeof aiResponse.presenceStatus === 'string' &&
        VALID_PRESENCE_STATUS_VALUES.includes(aiResponse.presenceStatus) &&
        (aiResponse.attitudeTowardPlayer === undefined || (typeof aiResponse.attitudeTowardPlayer === "string" && aiResponse.attitudeTowardPlayer.trim().length > 0 && aiResponse.attitudeTowardPlayer.trim().length <= 100)) &&
        (aiResponse.knowsPlayerAs === undefined || Array.isArray(aiResponse.knowsPlayerAs)) &&
        (aiResponse.lastKnownLocation === null || typeof aiResponse.lastKnownLocation === 'string') &&
        (aiResponse.preciseLocation === null || typeof aiResponse.preciseLocation === 'string') &&
        !(
          (aiResponse.presenceStatus === 'nearby' || aiResponse.presenceStatus === 'companion') &&
          (aiResponse.preciseLocation === null || aiResponse.preciseLocation === '')
        ) &&
        !(
          (aiResponse.presenceStatus === 'distant' || aiResponse.presenceStatus === 'unknown') &&
          aiResponse.preciseLocation !== null
        )
      ) {
        return { result: {
          ...aiResponse,
          attitudeTowardPlayer: aiResponse.attitudeTowardPlayer ?? DEFAULT_NPC_ATTITUDE,
          knowsPlayerAs: Array.isArray(aiResponse.knowsPlayerAs) ? aiResponse.knowsPlayerAs : [],
        } };
      }
      console.warn(
        `fetchCorrectedNPCDetails_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): Corrected details for "${npcName}" invalid or incomplete. Response:`,
        aiResponse,
      );
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedNPCDetails_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};

/**
 * Fetches a corrected "preciseLocation" string for an NPC in the current scene.
 */
export const fetchCorrectedCompanionOrNPCLocation_Service = async (
  npcName: string,
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  allRelevantMapNodes: Array<MapNode>,
  invalidPreciseLocationPayload: string,
  currentTheme: AdventureTheme
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error(`fetchCorrectedCompanionOrNPCLocation_Service: API Key not configured. Cannot correct location for "${npcName}".`);
    return null;
  }

  const knownPlacesString = allRelevantMapNodes.length > 0
    ? 'Known map locations in this theme that might be relevant: ' + formatKnownPlacesForPrompt(allRelevantMapNodes, true)
    : 'No specific map locations are currently known for this theme.';

  const prompt = `
You are an AI assistant tasked with correcting or inferring a character's "preciseLocation".
NPC Name: "${npcName}" (This NPC is currently present in the scene with the player).

"preciseLocation" definition:
- It describes the NPC's specific location or activity *within the current scene*.
- It MUST be a short, descriptive phrase (ideally under 50 characters, absolute max ~60 characters).
- Examples: "examining the bookshelf", "hiding behind barrels", "next to you", "across the room", "arguing with the guard".

- Narrative Context (use this to infer the location/activity):
- Log Message (may describe NPCs's actions): "${logMessage ?? 'Not specified, infer from scene.'}"
- Scene Description (primary source for NPCs's current state): "${sceneDescription ?? 'Not specified, infer from log.'}"
- ${knownPlacesString}

Malformed or Missing "preciseLocation" data from previous AI: "${invalidPreciseLocationPayload}"

Task: Based *only* on the NPC's name and the provided narrative context, determine the correct short "preciseLocation" string for this NPC within the current scene.

Respond ONLY with the corrected "preciseLocation" string. No other text, quotes, or markdown formatting.
Example Response: "examining the ancient map"
Example Response: "near you"
Example Response: If unclear from context, respond with a generic but plausible short phrase like "observing the surroundings" or "standing nearby".
`;

  const systemInstruction = `Infer or correct the NPC's "preciseLocation" (a short phrase, max ~50-60 chars, describing their in-scene activity/position) from narrative context and potentially malformed input. Respond ONLY with the string value. Adhere to theme context: ${currentTheme.storyGuidance}`;

  return retryAiCall<string>(async attempt => {
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
        const correctedLocation = aiResponse.trim();
        if (correctedLocation.length > 0 && correctedLocation.length <= 60) {
          console.warn(`fetchCorrectedCompanionOrNPCLocation_Service: Returned corrected NPC Location `, correctedLocation, ".");
          return { result: correctedLocation };
        }
        console.warn(
          `fetchCorrectedCompanionOrNPCLocation_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): Corrected preciseLocation for "${npcName}" was empty or too long: "${correctedLocation}"`,
        );
      } else {
        console.warn(
          `fetchCorrectedCompanionOrNPCLocation_Service (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}): AI call failed for preciseLocation of "${npcName}". Received: null`,
        );
      }
    } catch (error: unknown) {
      console.error(
        `fetchCorrectedCompanionOrNPCLocation_Service error (Attempt ${String(attempt + 1)}/${String(MAX_RETRIES + 1)}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
