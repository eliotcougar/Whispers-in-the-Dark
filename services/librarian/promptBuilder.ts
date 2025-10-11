import { Item, ItemData, NPC } from '../../types';
import { PLAYER_HOLDER_ID, WRITTEN_ITEM_TYPES } from '../../constants';
import { itemsToString, DEFAULT_ITEM_PROMPT_TEMPLATE } from '../../utils/promptFormatters/inventory';

const filterAllowedItems = (items: Array<Item>): Array<Item> => {
  const allowed = new Set(WRITTEN_ITEM_TYPES);
  return items.filter(item => allowed.has(item.type as (typeof WRITTEN_ITEM_TYPES)[number]));
};

const groupItemsByHolder = (items: Array<Item>): Map<string, Array<Item>> => {
  const grouped = new Map<string, Array<Item>>();
  items.forEach(item => {
    if (!item.holderId) return;
    const existing = grouped.get(item.holderId);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(item.holderId, [item]);
    }
  });
  return grouped;
};

const formatNpcInventories = (
  npcs: Array<NPC>,
  heading: string,
  itemsByHolder: Map<string, Array<Item>>,
): string => {
  if (npcs.length === 0) {
    return '';
  }

  const promptParts: Array<string> = [];
  npcs.forEach((npc, index) => {
    const npcItems = itemsByHolder.get(npc.id) ?? [];
    const labelPrefix = `ID: ${npc.id} - ${npc.name}: `;
    const promptPrefix = `${index === 0 ? `${heading}\n` : ''}${labelPrefix}`;
    const promptLine = itemsToString(
      npcItems,
      DEFAULT_ITEM_PROMPT_TEMPLATE,
      promptPrefix,
      '\n',
    );
    if (promptLine) {
      promptParts.push(promptLine);
    } else {
      promptParts.push(`${promptPrefix}None.\n`);
    }
  });

  return promptParts.join('');
};

export const buildLibrarianPrompt = (
  playerLastAction: string,
  librarianHint: string,
  newItems: Array<ItemData>,
  inventory: Array<Item>,
  currentNodeId: string | null,
  npcs: Array<NPC>,
  limitedMapContext: string,
): string => {
  const filteredInventory = filterAllowedItems(inventory);
  const itemsByHolder = groupItemsByHolder(filteredInventory);

  const companions = npcs.filter(npc => npc.presenceStatus === 'companion');
  const nearbyNpcs = npcs.filter(npc => npc.presenceStatus === 'nearby');

  const playerItems = itemsByHolder.get(PLAYER_HOLDER_ID) ?? [];
  const playerInventorySection = itemsToString(
    playerItems,
    DEFAULT_ITEM_PROMPT_TEMPLATE,
    'Current Player Inventory:\n',
    '\n',
  );

  const locationItems = currentNodeId ? itemsByHolder.get(currentNodeId) ?? [] : [];
  const locationInventorySection = itemsToString(
    locationItems,
    DEFAULT_ITEM_PROMPT_TEMPLATE,
    `Current Location Inventory - ID: ${currentNodeId ?? 'unknown'}\n`,
    '\n',
  );

  const companionsSection = formatNpcInventories(
    companions,
    'Companions Inventory:',
    itemsByHolder,
  );

  const nearbySection = formatNpcInventories(
    nearbyNpcs,
    'Nearby NPCs Inventory:',
    itemsByHolder,
  );

  const filteredNewItems = newItems.filter(it =>
    WRITTEN_ITEM_TYPES.includes(it.type as (typeof WRITTEN_ITEM_TYPES)[number]),
  );
  const newItemsSection = `New Items from Storyteller AI or Dialogue AI:\n${JSON.stringify(filteredNewItems, null, 2)}\n`;

  const sections: Array<string> = [];
  sections.push(newItemsSection);
  if (playerInventorySection) sections.push(`${playerInventorySection}\n`);
  if (locationInventorySection) sections.push(`${locationInventorySection}\n`);
  if (companionsSection) sections.push(companionsSection);
  if (nearbySection) sections.push(nearbySection);
  if (limitedMapContext) {
    sections.push(`Nearby Map Context where you can put Items:\n${limitedMapContext}\n`);
  }

  const body = sections.join('');

  return `- Player's Last Action: ${playerLastAction}
- Librarian Hint: "${librarianHint}".

${body}
Provide the librarian update as JSON as described in the SYSTEM_INSTRUCTION.`;
};
