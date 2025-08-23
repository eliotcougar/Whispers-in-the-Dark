/**
 * @file promptBuilder.ts
 * @description Helper for constructing prompts for the inventory service.
 */

/**
 * Builds the prompt for requesting inventory changes.
 */
import { NewItemSuggestion } from '../../types';
import { REGULAR_ITEM_TYPES } from '../../constants';

export const buildInventoryPrompt = (
  playerLastAction: string,
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  newItems: Array<NewItemSuggestion>,
  playerInventory: string,
  locationInventory: string,
  currentNodeId: string | null,
  companionsInventory: string,
  nearbyNpcsInventory: string,
  limitedMapContext: string,
): string => {
  const filtered = newItems.filter(it =>
    REGULAR_ITEM_TYPES.includes(it.type as (typeof REGULAR_ITEM_TYPES)[number]),
  );
  const newItemsJson = filtered.length > 0 ? JSON.stringify(filtered, null, 2) : '[]';
  return `- Player's Last Action: ${playerLastAction}
- Player Items Hint: "${playerItemsHint}";
- World Items Hint: "${worldItemsHint}";
- NPC Items Hint: "${npcItemsHint}".

${newItemsJson ? `New Items from Storyteller AI or Dialogue AI:\n${newItemsJson}\n` : ''}
${playerInventory ? `Current Player's Inventory:\n${playerInventory}\n` : ''}
${locationInventory ? `Current Location Inventory - ID: ${currentNodeId ?? 'unknown'}\n${locationInventory}\n` : ''}
${companionsInventory ? `Companions Inventory:\n${companionsInventory}\n` : ''}
${nearbyNpcsInventory ? `Nearby NPCs Inventory:\n${nearbyNpcsInventory}\n` : ''}
${limitedMapContext ? `Nearby Map Context where you can put Items:\n${limitedMapContext}\n` : ''}

Provide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;
};
