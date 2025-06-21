/**
 * @file responseParser.ts
 * @description Parses inventory AI responses.
 */

import { ItemChange, GiveItemPayload, ItemReference } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidItem, isValidItemReference } from '../parsers/validation';
import { normalizeItemType, DESTROY_SYNONYMS } from '../../utils/itemSynonyms';

export interface InventoryAIPayload {
  itemChanges: Array<ItemChange>;
  observations?: string;
  rationale?: string;
}

/**
 * Parses the AI response text into an InventoryAIPayload structure.
 */
const parseItemChange = (raw: Record<string, unknown>): ItemChange | null => {
  const action = typeof raw.action === 'string' ? raw.action : null;
  if (!action) return null;
  switch (action) {
    case 'gain':
    case 'put':
      return isValidItem(raw.item, 'gain') ? { action, item: raw.item } : null;
    case 'update': {
      if (raw.item && typeof raw.item === 'object') {
        const rawItem = raw.item as Record<string, unknown>;
        const t = typeof rawItem.type === 'string' ? rawItem.type : undefined;
        const status = typeof rawItem.status === 'string' ? rawItem.status : undefined;
        const mapped = t ? normalizeItemType(t) : null;
        const statusVal = status ? status.toLowerCase() : null;
        const rawTypeVal = t ? t.toLowerCase() : null;
        if (
          (mapped && DESTROY_SYNONYMS.has(mapped)) ||
          (rawTypeVal && DESTROY_SYNONYMS.has(rawTypeVal)) ||
          (statusVal && DESTROY_SYNONYMS.has(statusVal))
        ) {
          const itemRef: ItemReference = {
            id: typeof rawItem.id === 'string' ? rawItem.id : undefined,
            name: typeof rawItem.name === 'string' ? rawItem.name : undefined,
          };
          return isValidItemReference(itemRef) ? { action: 'destroy', item: itemRef } : null;
        }
      }
      return isValidItem(raw.item, 'update') ? { action: 'update', item: raw.item } : null;
    }
    case 'destroy':
      return isValidItemReference(raw.item) ? { action: 'destroy', item: raw.item } : null;
    case 'give':
    case 'take':
      return raw.item &&
        typeof raw.item === 'object' &&
        typeof (raw.item as GiveItemPayload).id === 'string' &&
        typeof (raw.item as GiveItemPayload).fromId === 'string' &&
        typeof (raw.item as GiveItemPayload).toId === 'string'
        ? { action, item: raw.item as GiveItemPayload }
        : null;
    default:
      return null;
  }
};

export const parseInventoryResponse = (
  responseText: string,
): InventoryAIPayload | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!parsed) return null;

  let payload: InventoryAIPayload | null = null;

  const validateArray = (arr: Array<unknown>): Array<ItemChange> => {
    const validated: Array<ItemChange> = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const parsedChange = parseItemChange(raw as Record<string, unknown>);
      if (parsedChange) validated.push(parsedChange);
    }
    return validated;
  };

  if (Array.isArray(parsed)) {
    // Simple array of ItemChange objects
    payload = { itemChanges: validateArray(parsed) };
  } else if (typeof parsed === 'object') {
    const obj = parsed as Partial<InventoryAIPayload & { itemChanges: unknown }>;
    const arr = Array.isArray(obj.itemChanges) ? obj.itemChanges : [];
    payload = {
      itemChanges: validateArray(arr),
      observations: typeof obj.observations === 'string' ? obj.observations : undefined,
      rationale: typeof obj.rationale === 'string' ? obj.rationale : undefined,
    };
  }

  return payload;
};
