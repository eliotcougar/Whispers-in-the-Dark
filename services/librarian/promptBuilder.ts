import { Item, ItemDirective, NPC } from '../../types';
import { PLAYER_HOLDER_ID, WRITTEN_ITEM_TYPES } from '../../constants';
import { itemsToString, DEFAULT_ITEM_PROMPT_TEMPLATE } from '../../utils/promptFormatters/inventory';

export interface LibrarianPromptBuildParams {
  directives: Array<ItemDirective>;
  inventory: Array<Item>;
  currentNodeId: string | null;
  npcs: Array<NPC>;
  limitedMapContext: string;
  holderNames: Record<string, string>;
  playerLastAction: string;
  sceneDescription?: string;
  logMessage?: string;
  locationSnippet?: string;
}

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
    const labelPrefix = `<ID: ${npc.id}> - ${npc.name}: `;
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

const formatHolderCatalog = (holderNames: Record<string, string>): string => {
  const entries = Object.entries(holderNames);
  if (entries.length === 0) return 'None.';
  return entries.map(([id, name]) => `${id}: ${name}`).join('\n');
};

const describeDirective = (
  directive: ItemDirective,
  matchingItems: Array<Item>,
  holderNames: Record<string, string>,
): string => {
  const itemIds = Array.isArray(directive.itemIds)
    ? directive.itemIds
    : directive.itemIds
      ? [directive.itemIds]
      : [];
  const matched = matchingItems
    .map(item => {
      const holderLabel = holderNames[item.holderId] ?? item.holderId;
      return `<ID: ${item.id}> - ${item.name} (${item.type}) held by ${holderLabel}`;
    })
    .join('\n');
  const provisional = directive.provisionalNames?.length
    ? `\nProvisional (untracked placeholders for new written items): ${directive.provisionalNames.join(', ')}`
    : '';
  const suggested = directive.suggestedHandler ? `\nSuggested Handler: ${directive.suggestedHandler}` : '';
  const idsLine = itemIds.length > 0 ? `\nItem IDs: ${itemIds.map(id => `<ID: ${id}>`).join(', ')}` : '';
  const metadata =
    directive.metadata && Object.keys(directive.metadata).length > 0
      ? `\nMetadata: ${JSON.stringify(directive.metadata)}`
      : '';
  const matchesLine = matched ? `\nMatched Items:\n${matched}` : '';
  return [
    `<ID: ${directive.directiveId}> - ${directive.instruction}`,
    suggested,
    idsLine,
    provisional,
    metadata,
    matchesLine,
  ]
    .filter(Boolean)
    .join('');
};

export const buildLibrarianPrompt = ({
  directives,
  inventory,
  currentNodeId,
  npcs,
  limitedMapContext,
  holderNames,
  playerLastAction,
  sceneDescription,
  logMessage,
  locationSnippet,
}: LibrarianPromptBuildParams): string => {
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
    `Current Location Inventory - <ID: ${currentNodeId ?? 'unknown'}>\n`,
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

  const directiveMatches = directives.map(directive => ({
    directive,
    matches: filteredInventory.filter(item => {
      if (!directive.itemIds) return false;
      const ids = Array.isArray(directive.itemIds) ? directive.itemIds : [directive.itemIds];
      return ids.includes(item.id);
    }),
  }));

  const directiveSection = directives.length
    ? directives
        .map(dir => {
          const match = directiveMatches.find(dm => dm.directive.directiveId === dir.directiveId);
          return describeDirective(dir, match?.matches ?? [], holderNames);
        })
        .join('\n\n')
    : 'None.';

  const holderCatalog = formatHolderCatalog(holderNames);

  const sections: Array<string> = [];
  sections.push(`Holder Catalog:\n${holderCatalog}\n`);
  sections.push(`## Item Directives (Librarian + Shared)\n${directiveSection}\n`);
  if (playerInventorySection) sections.push(`${playerInventorySection}\n`);
  if (locationInventorySection) sections.push(`${locationInventorySection}\n`);
  if (companionsSection) sections.push(companionsSection);
  if (nearbySection) sections.push(nearbySection);
  if (limitedMapContext) {
    sections.push(`Nearby Map Context where you can put Items:\n${limitedMapContext}\n`);
  }

  const prompt = `- Player's Last Action: ${playerLastAction}
- Scene Snapshot: ${sceneDescription ?? 'N/A'}
- Log Message: ${logMessage ?? 'N/A'}
- Location Snippet: ${locationSnippet ?? (limitedMapContext || 'N/A')}

${sections.join('\n')}`;

  return prompt;
};
