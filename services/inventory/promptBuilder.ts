/**
 * @file promptBuilder.ts
 * @description Helper for constructing prompts for the inventory service.
 */

/**
 * Builds the prompt for requesting inventory changes.
 */
import { NewItemSuggestion } from '../../types';

export const buildInventoryPrompt = (
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  newItems: NewItemSuggestion[],
): string => {
  const newItemsJson = newItems.length > 0 ? `\`\`\`json\n${JSON.stringify(newItems, null, 2)}\n\`\`\`` : '[]';
  return `
  - Player's Last Action: TODO
  - Player Items Hint: "${playerItemsHint}";
  - World Items Hint: "${worldItemsHint}";
  - NPC Items Hint: "${npcItemsHint}".
  
  ${newItemsJson? `New Items from Storyteller AI or Dialogue AI:\n${newItemsJson}\n` : ''}
  Current Player's Inventory: TODO
  Current Location Inventory: TODO
  Companions Inventory: TODO
  Nearby NPCs Inventory: TODO

  Provide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;
};
