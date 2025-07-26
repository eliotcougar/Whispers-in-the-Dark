import { NewItemSuggestion } from '../../types';

export const buildLibrarianPrompt = (
  playerLastAction: string,
  librarianHint: string,
  newItems: Array<NewItemSuggestion>,
  playerInventory: string,
  locationInventory: string,
  currentNodeId: string | null,
  companionsInventory: string,
  nearbyNpcsInventory: string,
  limitedMapContext: string,
): string => {
  const newItemsJson =
    newItems.length > 0 ? JSON.stringify(newItems, null, 2) : '[]';
  return `- Player's Last Action: ${playerLastAction}
- Librarian Hint: "${librarianHint}".

${newItemsJson ? `New Items from Storyteller AI or Dialogue AI:\n${newItemsJson}\n` : ''}
${playerInventory ? `Current Player's Inventory:\n${playerInventory}\n` : ''}
${locationInventory ? `Current Location Inventory - ID: ${currentNodeId ?? 'unknown'}\n${locationInventory}\n` : ''}
${companionsInventory ? `Companions Inventory:\n${companionsInventory}\n` : ''}
${nearbyNpcsInventory ? `Nearby NPCs Inventory:\n${nearbyNpcsInventory}\n` : ''}
${limitedMapContext ? `Nearby Map Context where you can put Items:\n${limitedMapContext}\n` : ''}

Provide the librarian update as JSON as described in the SYSTEM_INSTRUCTION.`;
};
