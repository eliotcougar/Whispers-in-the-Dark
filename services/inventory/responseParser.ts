/**
 * @file responseParser.ts
 * @description Parses inventory AI responses.
 */

import {
  ItemChange,
  MoveItemPayload,
  ItemReference,
  KnownUse,
  AddDetailsPayload,
} from '../../types';
import { safeParseJson } from '../../utils/jsonUtils';
import { isValidItem, isValidItemReference, isValidAddDetailsPayload } from '../parsers/validation';
import { filterBlockedKnownUses } from '../../utils/knownUseUtils';
import { PLAYER_HOLDER_ID } from '../../constants';
import { normalizeItemType, DESTROY_SYNONYMS } from '../../utils/itemSynonyms';

export interface InventoryAIPayload {
  itemChanges: Array<ItemChange>;
  observations?: string;
  rationale?: string;
}

/**
 * Parses the AI response text into an InventoryAIPayload structure.
 */
const parseItemChange = (
  raw: Record<string, unknown>,
  action: ItemChange['action'],
  recordError?: (message: string) => void,
): ItemChange | null => {
  switch (action) {
    case 'create': {
      const item = raw;
      if (typeof item.holderId !== 'string' || item.holderId.trim() === '') {
        item.holderId = PLAYER_HOLDER_ID;
      }
      if (isValidItem(item, 'create')) {
        const itm = item as { knownUses?: Array<KnownUse> };
        itm.knownUses = filterBlockedKnownUses(itm.knownUses);
        return { action, item: item };
      }
      recordError?.('Inventory create action was missing required item fields.');
      return null;
    }
    case 'change': {
      const rawItem = raw;
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
        if (isValidItemReference(itemRef)) return { action: 'destroy', item: itemRef };
        recordError?.('Inventory change action attempted to destroy an item without a valid id or name.');
        return null;
      }
      if (isValidItem(raw, 'change')) {
        const itm = raw as { knownUses?: Array<KnownUse> };
        itm.knownUses = filterBlockedKnownUses(itm.knownUses);
        return { action: 'change', item: raw };
      }
      recordError?.('Inventory change action had invalid item payload.');
      return null;
    }
    case 'addDetails': {
      if (isValidAddDetailsPayload(raw)) {
        return { action: 'addDetails', item: raw as AddDetailsPayload };
      }
      recordError?.('Inventory addDetails action payload was invalid.');
      return {
        action: 'addDetails',
        item: raw as unknown as AddDetailsPayload,
        invalidPayload: raw,
      };
    }
    case 'destroy':
      if (isValidItemReference(raw)) return { action: 'destroy', item: raw };
      recordError?.('Inventory destroy action requires an item reference with id or name.');
      return null;
    case 'move': {
      const maybe = raw as { id?: string; name?: string; newHolderId?: string };
      if (typeof maybe.id === 'string' && typeof maybe.newHolderId === 'string') {
        const payload: MoveItemPayload = {
          id: maybe.id,
          name: maybe.name,
          newHolderId: maybe.newHolderId,
        };
        return { action, item: payload };
      }
      recordError?.('Inventory move action must include id and newHolderId strings.');
      return null;
    }
    default:
      recordError?.(`Inventory action "${String(action)}" is not supported.`);
      return null;
  }
};

export const parseInventoryResponse = (
  responseText: string,
  onParseError?: (message: string) => void,
): InventoryAIPayload | null => {
  let firstError: string | null = null;
  const recordError = (message: string) => {
    firstError ??= message;
  };
  const parsed = safeParseJson<unknown>(responseText);
  if (!parsed) {
    onParseError?.('Inventory response was not valid JSON.');
    return null;
  }

  let payload: InventoryAIPayload | null = null;

  const validateArray = (
    arr: Array<unknown>,
    action: ItemChange['action'],
  ): Array<ItemChange> => {
    const validated: Array<ItemChange> = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const parsedChange = parseItemChange(raw as Record<string, unknown>, action, recordError);
      if (parsedChange) validated.push(parsedChange);
    }
    return validated;
  };

  const validateMixedArray = (arr: Array<unknown>): Array<ItemChange> => {
    const validated: Array<ItemChange> = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const maybe = raw as { action?: unknown; item?: unknown };
      const act = typeof maybe.action === 'string' ? maybe.action : undefined;
      const itm = maybe.item && typeof maybe.item === 'object' ? maybe.item : undefined;
      if (act && itm) {
        const parsedChange = parseItemChange(
          itm as Record<string, unknown>,
          act as ItemChange['action'],
          recordError,
        );
        if (parsedChange) validated.push(parsedChange);
      }
    }
    return validated;
  };

  if (Array.isArray(parsed)) {
    payload = { itemChanges: validateArray(parsed, 'create') };
  } else if (typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const allChanges: Array<ItemChange> = [];
    if (Array.isArray(obj.create)) {
      allChanges.push(...validateArray(obj.create as Array<unknown>, 'create'));
    }
    if (Array.isArray(obj.change)) {
      allChanges.push(...validateArray(obj.change as Array<unknown>, 'change'));
    }
    if (Array.isArray(obj.move)) {
      allChanges.push(...validateArray(obj.move as Array<unknown>, 'move'));
    }
    if (Array.isArray(obj.destroy)) {
      allChanges.push(...validateArray(obj.destroy as Array<unknown>, 'destroy'));
    }
    if (Array.isArray(obj.addDetails)) {
      allChanges.push(...validateArray(obj.addDetails as Array<unknown>, 'addDetails'));
    }
    if (Array.isArray(obj.itemChanges)) {
      allChanges.push(...validateMixedArray(obj.itemChanges as Array<unknown>));
    }
    payload = {
      itemChanges: allChanges,
      observations: typeof obj.observations === 'string' ? obj.observations : undefined,
      rationale: typeof obj.rationale === 'string' ? obj.rationale : undefined,
    };
  }

  if (!payload) {
    if (typeof firstError === 'string') {
      onParseError?.(firstError);
    } else {
      onParseError?.('Inventory response must be a JSON object or array describing item changes.');
    }
  }

  return payload;
};
