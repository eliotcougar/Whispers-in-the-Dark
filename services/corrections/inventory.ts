/**
 * @file services/corrections/inventory.ts
 * @description Correction helper for malformed inventory AI responses.
 */
import { AdventureTheme, ItemChange } from '../../types';
import {
  MAX_RETRIES,
  VALID_ITEM_TYPES_STRING,
  PLAYER_HOLDER_ID,
} from '../../constants';
import { callCorrectionAI } from './base';
import { isApiConfigured } from '../apiClient';
import { retryAiCall } from '../../utils/retry';
import { parseInventoryResponse } from '../inventory/responseParser';

const VALID_ACTIONS = ['gain', 'destroy', 'update', 'put', 'give', 'take'] as const;
const VALID_ACTIONS_STRING = VALID_ACTIONS.map(a => `"${a}"`).join(' | ');

/**
 * Attempts to correct a malformed array of ItemChange objects returned by the
 * Inventory AI helper.
 */
export const fetchCorrectedItemChangeArray_Service = async (
  malformedResponseText: string,
  logMessage: string | undefined,
  sceneDescription: string | undefined,
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  currentNodeId: string | null,
  companionsContext: string,
  nearbyNpcsContext: string,
  currentTheme: AdventureTheme,
): Promise<ItemChange[] | null> => {
  if (!isApiConfigured()) {
    console.error('fetchCorrectedItemChangeArray_Service: API Key not configured.');
    return null;
  }

  const prompt = `
Role: You are an AI assistant fixing a malformed inventory update JSON payload for a text adventure game.
Malformed Payload:
\`\`\`json
${malformedResponseText}
\`\`\`

Narrative Context:
- Log Message: "${logMessage || 'Not specified'}"
- Scene Description: "${sceneDescription || 'Not specified'}"
- Player Items Hint: "${playerItemsHint}"
- World Items Hint: "${worldItemsHint}"
- NPC Items Hint: "${npcItemsHint}"
- Current Place ID: "${currentNodeId || 'unknown'}"
- Companions: ${companionsContext}
- Nearby NPCs: ${nearbyNpcsContext}
- Theme Guidance: "${currentTheme.systemInstructionModifier || 'General adventure theme.'}"

Task: Provide ONLY the corrected JSON array of ItemChange objects.`;

  const systemInstruction = `Correct a JSON array of ItemChange objects for the inventory system. Each element must follow this structure:\n{ "action": (${VALID_ACTIONS_STRING}), "item": { ... } }\nValid item types: ${VALID_ITEM_TYPES_STRING}. Holder IDs can be "${PLAYER_HOLDER_ID}", "${currentNodeId || 'unknown'}", companion IDs, or nearby NPC IDs from the context. Respond ONLY with the corrected JSON array.`;

  return retryAiCall<ItemChange[]>(async attempt => {
    try {
      const aiResponse = await callCorrectionAI<ItemChange[]>(prompt, systemInstruction);
      const parsedResult = aiResponse ? parseInventoryResponse(JSON.stringify(aiResponse)) : null;
      const validatedChanges = parsedResult ? parsedResult.itemChanges : null;
      if (validatedChanges) {
        return { result: validatedChanges };
      }
      console.warn(
        `fetchCorrectedItemChangeArray_Service (Attempt ${attempt + 1}/${MAX_RETRIES + 1}): corrected payload invalid.`,
        aiResponse,
      );
    } catch (error) {
      console.error(
        `fetchCorrectedItemChangeArray_Service error (Attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
        error,
      );
      throw error;
    }
    return { result: null };
  });
};
