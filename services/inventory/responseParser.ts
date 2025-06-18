/**
 * @file responseParser.ts
 * @description Parses inventory AI responses.
 */

import { ItemChange, GiveItemPayload } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidItem, isValidItemReference } from '../parsers/validation';
import { normalizeItemType, DESTROY_SYNONYMS } from '../../utils/itemSynonyms';

export interface InventoryAIPayload {
  itemChanges: ItemChange[];
  observations?: string;
  rationale?: string;
}

/**
 * Parses the AI response text into an InventoryAIPayload structure.
 */
export const parseInventoryResponse = (
  responseText: string,
): InventoryAIPayload | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!parsed) return null;

  let payload: InventoryAIPayload | null = null;

  const validateArray = (arr: unknown[]): ItemChange[] => {
    const valid: ItemChange[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const change = raw as ItemChange;
      if (typeof change.action !== 'string') continue;
      const action = change.action;
      let ok = false;
      switch (action) {
        case 'gain':
        case 'put':
          ok = isValidItem(change.item, 'gain');
          break;
        case 'update':
          if (change.item && typeof change.item === 'object') {
            const rawItem = change.item as Record<string, unknown>;
            const t = typeof rawItem.type === 'string' ? rawItem.type : undefined;
            const status = typeof rawItem.status === 'string' ? rawItem.status : undefined;
            const mappedType = t ? normalizeItemType(t) : null;
            const statusVal = status ? status.toLowerCase() : null;
            const rawTypeVal = t ? t.toLowerCase() : null;
            if ((mappedType && DESTROY_SYNONYMS.has(mappedType)) || (rawTypeVal && DESTROY_SYNONYMS.has(rawTypeVal)) || (statusVal && DESTROY_SYNONYMS.has(statusVal))) {
              change.action = 'destroy';
              change.item = {
                id: typeof rawItem.id === 'string' ? rawItem.id : undefined,
                name: typeof rawItem.name === 'string' ? rawItem.name : undefined,
              };
              ok = isValidItemReference(change.item);
              break;
            }
          }
          ok = isValidItem(change.item, 'update');
          break;
        case 'destroy':
          ok = isValidItemReference(change.item);
          break;
        case 'give':
        case 'take':
          ok = !!(
            change.item &&
            typeof change.item === 'object' &&
            typeof (change.item as GiveItemPayload).id === 'string' &&
            typeof (change.item as GiveItemPayload).fromId === 'string' &&
            typeof (change.item as GiveItemPayload).toId === 'string'
          );
          break;
      }
      if (ok) valid.push(change);
    }
    return valid;
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
