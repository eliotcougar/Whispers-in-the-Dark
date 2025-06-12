/**
 * @file promptBuilder.ts
 * @description Helper for constructing prompts for the inventory service.
 */

/**
 * Builds the prompt for requesting inventory changes.
 */
import { Item } from '../../types';

export const buildInventoryPrompt = (
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  suggestedItems: Item[],
): string => {
  const itemsList =
    suggestedItems.length > 0
      ? suggestedItems
          .map(
            (it) =>
              `- ${it.id} | "${it.name}" | ${it.type} | ${it.description}`,
          )
          .join('\n')
      : 'None.';
  return `Player Items Hint:\n${playerItemsHint}\n\nWorld Items Hint:\n${worldItemsHint}\n\nNPC Items Hint:\n${npcItemsHint}\n\nSuggested Items:\n${itemsList}\n\nProvide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;
};
