/**
 * @file promptBuilder.ts
 * @description Helper for constructing prompts for the inventory service.
 */

/**
 * Builds the prompt for requesting inventory changes.
 */
export const buildInventoryPrompt = (
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  suggestedItemIds: string[],
): string => `Player Items Hint:\n${playerItemsHint}\n\nWorld Items Hint:\n${worldItemsHint}\n\nNPC Items Hint:\n${npcItemsHint}\n\nSuggested Item IDs: ${suggestedItemIds.join(', ')}\n\nProvide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;
