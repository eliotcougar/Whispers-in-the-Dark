/**
 * @file promptBuilder.ts
 * @description Helper for constructing prompts for the inventory service using item directives.
 */

import { Item, ItemDirective, NPC } from '../../types';
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

export interface InventoryPromptBuildParams {
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
    ? `\nProvisional (untracked placeholders for new items): ${directive.provisionalNames.join(', ')}`
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

export const buildInventoryPrompt = ({
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
}: InventoryPromptBuildParams): InventoryPromptBuildResult => {
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
  const contextLines = [
    `- Player's Last Action: ${playerLastAction}`,
    `- Scene Snapshot: ${sceneDescription ?? 'N/A'}`,
    `- Log Message: ${logMessage ?? 'N/A'}`,
    `- Location Snippet: ${locationSnippet ?? (limitedMapContext || 'N/A')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const sections: Array<string> = [];
  sections.push(`Holder Catalog:\n${holderCatalog}\n`);
  sections.push(`## Item Directives (Inventory + Shared)\n${directiveSection}\n`);
  if (playerInventorySection) sections.push(`${playerInventorySection}\n`);
  if (locationInventorySection) sections.push(`${locationInventorySection}\n`);
  if (companionsInventory.promptSection) sections.push(companionsInventory.promptSection);
  if (nearbyInventory.promptSection) sections.push(nearbyInventory.promptSection);
  if (limitedMapContext) {
    sections.push(`Nearby Map Context where you can put Items:\n${limitedMapContext}\n`);
  }

  const body = sections.join('\n');

  const prompt = `${contextLines}

${body}

Safety rails:
- Echo the directiveId on every action you output so the supervisor can deduplicate work.
- Prefer existing itemIds and holderIds from the catalog; avoid inventing new IDs.
- Only create new regular items when directives clearly describe a new object; do not fabricate written items.
- Names must be comma-free.

Provide the inventory update as JSON as described in the SYSTEM_INSTRUCTION.`;

  return {
    prompt,
    companionsContext: companionsInventory.correctionContext,
    nearbyNpcsContext: nearbyInventory.correctionContext,
  };
};
