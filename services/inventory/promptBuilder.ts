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
  return `Player Items Hint:\n${playerItemsHint}\n\nWorld Items Hint:\n${worldItemsHint}\n\nNPC Items Hint:\n${npcItemsHint}\n\nnewItems from Storyteller or Dialogue:\n${newItemsJson}\n\nProvide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;
};
