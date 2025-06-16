/**
 * @file responseParser.ts
 * @description Parses inventory AI responses.
 */

import { ItemChange, GiveItemPayload } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidItem, isValidItemReference } from '../parsers/validation';

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
