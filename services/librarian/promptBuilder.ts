import { NewItemSuggestion } from '../../types';
import { WRITTEN_ITEM_TYPES } from '../../constants';

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
  const filtered = newItems.filter(it =>
    WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]),
  );
  const newItemsJson = filtered.length > 0 ? JSON.stringify(filtered, null, 2) : '[]';
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
