/**
 * @file responseParser.ts
 * @description Parses inventory AI responses.
 */

import { ItemChange, GiveItemPayload } from '../../types';
import { extractJsonFromFence, safeParseJson } from '../../utils/jsonUtils';
import { isValidItem, isValidItemReference } from '../parsers/validation';

/**
 * Parses the AI response text into an array of ItemChange objects.
 */
export const parseInventoryResponse = (responseText: string): ItemChange[] | null => {
  const jsonStr = extractJsonFromFence(responseText);
  const parsed = safeParseJson<unknown>(jsonStr);
  if (!Array.isArray(parsed)) {
    console.warn('Inventory response was not an array:', parsed);
    return null;
  }
  const valid: ItemChange[] = [];
  for (const raw of parsed) {
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
      case 'lose':
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
