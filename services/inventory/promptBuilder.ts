/**
 * @file promptBuilder.ts
 * @description Helper for constructing prompts for the inventory service.
 */

import { Item, ItemData, NPC } from '../../types';
import { PLAYER_HOLDER_ID, REGULAR_ITEM_TYPES } from '../../constants';
import { itemsToString, DEFAULT_ITEM_PROMPT_TEMPLATE } from '../../utils/promptFormatters/inventory';

interface NpcInventorySection {
  promptSection: string;
  correctionContext: string;
}

export interface InventoryPromptBuildResult {
  prompt: string;
  companionsContext: string;
  nearbyNpcsContext: string;
}

const filterAllowedItems = (items: Array<Item>): Array<Item> => {
  const allowed = new Set(REGULAR_ITEM_TYPES);
  return items.filter(item => allowed.has(item.type as (typeof REGULAR_ITEM_TYPES)[number]));
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
): NpcInventorySection => {
  if (npcs.length === 0) {
    return { promptSection: '', correctionContext: 'None.' };
  }

  const promptParts: Array<string> = [];
  const contextParts: Array<string> = [];

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
      const contextLine = itemsToString(
        npcItems,
        DEFAULT_ITEM_PROMPT_TEMPLATE,
        labelPrefix,
      );
      contextParts.push(contextLine ? contextLine : `${labelPrefix}None.`);
    } else {
      promptParts.push(`${promptPrefix}None.\n`);
      contextParts.push(`${labelPrefix}None.`);
    }
  });

  const promptSection = promptParts.join('');
  const correctionContext = contextParts.length > 0 ? contextParts.join('\n') : 'None.';

  return {
    promptSection: promptSection.trim().length > 0 ? promptSection : '',
    correctionContext,
  };
};

export const buildInventoryPrompt = (
  playerLastAction: string,
  playerItemsHint: string,
  worldItemsHint: string,
  npcItemsHint: string,
  newItems: Array<ItemData>,
  inventory: Array<Item>,
  currentNodeId: string | null,
  npcs: Array<NPC>,
  limitedMapContext: string,
): InventoryPromptBuildResult => {
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

  const companionsInventory = formatNpcInventories(
    companions,
    'Companions Inventory:',
    itemsByHolder,
  );

  const nearbyInventory = formatNpcInventories(
    nearbyNpcs,
    'Nearby NPCs Inventory:',
    itemsByHolder,
  );

  const filteredNewItems = newItems.filter(it =>
    REGULAR_ITEM_TYPES.includes(it.type as (typeof REGULAR_ITEM_TYPES)[number]),
  );
  const newItemsSection = `New Items from Storyteller AI or Dialogue AI:\n${JSON.stringify(filteredNewItems, null, 2)}\n`;

  const sections: Array<string> = [];
  sections.push(newItemsSection);
  if (playerInventorySection) sections.push(`${playerInventorySection}\n`);
  if (locationInventorySection) sections.push(`${locationInventorySection}\n`);
  if (companionsInventory.promptSection) sections.push(companionsInventory.promptSection);
  if (nearbyInventory.promptSection) sections.push(nearbyInventory.promptSection);
  if (limitedMapContext) {
    sections.push(`Nearby Map Context where you can put Items:\n${limitedMapContext}\n`);
  }

  const body = sections.join('');

  const prompt = `- Player's Last Action: ${playerLastAction}
- Player Items Hint: "${playerItemsHint}";
- World Items Hint: "${worldItemsHint}";
- NPC Items Hint: "${npcItemsHint}".

${body}
Provide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;

  return {
    prompt,
    companionsContext: companionsInventory.correctionContext,
    nearbyNpcsContext: nearbyInventory.correctionContext,
  };
};
