/**
 * @file inventoryUtils.ts
 * @description Simplified helpers for inventory actions and change tracking.
 */

import {
  Item,
  ItemChange,
  ItemChangePayload,
  ItemChangeRecord,
  ItemCreatePayload,
} from '../types';
import { buildItemId, findItemByIdentifier } from './entityUtils';
import { PLAYER_HOLDER_ID } from '../constants';

const normalizeCreatedItem = (payload: ItemCreatePayload): Item => {
  const id = payload.id ?? buildItemId(payload.name);
  const holderId =
    payload.holderId.trim() === '' ? PLAYER_HOLDER_ID : payload.holderId;
  return {
    ...payload,
    id,
    holderId,
    activeDescription: payload.activeDescription ?? undefined,
    isActive: payload.isActive ?? false,
    knownUses: payload.knownUses ?? [],
    tags: payload.tags ?? [],
  };
};

const updateItemCore = (
  existing: Item,
  payload: ItemChangePayload,
): Item => {
  const updated: Item = { ...existing };
  if (payload.type !== undefined) updated.type = payload.type;
  if (payload.description !== undefined) updated.description = payload.description;
  if (payload.activeDescription !== undefined) {
    if (payload.activeDescription === null) {
      updated.activeDescription = undefined;
    } else {
      updated.activeDescription = payload.activeDescription;
    }
  }
  if (payload.isActive !== undefined) {
    updated.isActive = payload.isActive;
  }
  if (payload.activeDescription === null) {
    // Clearing the active description should always put the item back into an inactive state.
    updated.isActive = false;
  }
  if (payload.tags !== undefined) updated.tags = payload.tags;
  if (payload.chapters !== undefined) updated.chapters = payload.chapters;
  if (payload.knownUses !== undefined) updated.knownUses = payload.knownUses;
  if (payload.holderId !== undefined && payload.holderId.trim() !== '') {
    updated.holderId = payload.holderId;
  }
  return updated;
};

export const applyItemChangeAction = (
  inventory: Array<Item>,
  change: ItemChange,
): Array<Item> => {
  let inv = [...inventory];
  switch (change.action) {
    case 'create': {
      const newItem = normalizeCreatedItem(change.item);
      const idx = inv.findIndex(i => i.id === newItem.id);
      if (idx !== -1) inv[idx] = newItem;
      else inv.push(newItem);
      break;
    }
    case 'destroy': {
      const ref = change.item;
      const found = findItemByIdentifier([ref.id, ref.name], inv, false, true);
      const match = Array.isArray(found) ? null : found;
      if (match) inv = inv.filter(i => i.id !== match.id);
      break;
    }
    case 'move': {
      const payload = change.item;
      const found = findItemByIdentifier([payload.id, payload.name], inv, false, true);
      const item = Array.isArray(found) ? null : found;
      if (item) {
        const idx = inv.findIndex(i => i.id === item.id);
        inv[idx] = { ...item, holderId: payload.newHolderId };
      }
      break;
    }
    case 'change': {
      const payload = change.item;
      const found = findItemByIdentifier([payload.id, payload.name], inv, false, true);
      const item = Array.isArray(found) ? null : found;
      if (item) {
        const idx = inv.findIndex(i => i.id === item.id);
        const renameOnly =
          payload.newName === undefined &&
          payload.name !== undefined &&
          payload.name !== item.name;
        const finalName = payload.newName ?? (renameOnly ? payload.name : undefined);
        const updated = updateItemCore(item, payload);
        if (finalName && finalName.trim() !== '' && finalName !== item.name) {
          updated.name = finalName;
        }
        inv[idx] = updated;
      }
      break;
    }
    case 'addDetails': {
      const payload = change.item;
      const found = findItemByIdentifier([payload.id, payload.name], inv, false, true);
      const item = Array.isArray(found) ? null : found;
      if (item) {
        const idx = inv.findIndex(i => i.id === item.id);
        const updated: Item = { ...item };
        if (payload.chapters && payload.chapters.length > 0) {
          updated.chapters = [...(item.chapters ?? []), ...payload.chapters];
        }
        if (payload.tags && payload.tags.length > 0) {
          const set = new Set(item.tags ?? []);
          for (const t of payload.tags) set.add(t);
          updated.tags = Array.from(set);
        }
        if (payload.knownUses && payload.knownUses.length > 0) {
          const ku = [...(item.knownUses ?? [])];
          for (const u of payload.knownUses) {
            const iKu = ku.findIndex(k => k.actionName === u.actionName);
            if (iKu !== -1) ku[iKu] = u;
            else ku.push(u);
          }
          updated.knownUses = ku;
        }
        updated.lastInspectTurn = undefined;
        inv[idx] = updated;
      }
      break;
    }
    default:
      break;
  }
  return inv;
};

export const buildItemChangeRecords = (
  changes: Array<ItemChange>,
  currentInventory: Array<Item>,
): Array<ItemChangeRecord> => {
  const records: Array<ItemChangeRecord> = [];
  for (const change of changes) {
    let record: ItemChangeRecord | null = null;
    if (change.action === 'create') {
      const newItem = normalizeCreatedItem(change.item);
      record = {
        type: 'acquire',
        acquiredItem: {
          ...newItem,
        },
      };
    } else if (change.action === 'destroy') {
      const ref = change.item;
      const found = findItemByIdentifier([ref.id, ref.name], currentInventory, false, true);
      const lost = Array.isArray(found) ? null : found;
      if (lost) record = { type: 'loss', lostItem: { ...lost } };
    } else if (change.action === 'move') {
      const payload = change.item;
      const found = findItemByIdentifier([payload.id, payload.name], currentInventory, false, true);
      const item = Array.isArray(found) ? null : found;
      if (item) {
        const oldCopy = { ...item };
        const newItem = { ...item, holderId: payload.newHolderId };
        record = { type: 'update', oldItem: oldCopy, newItem };
      }
    } else if (change.action === 'change') {
      const payload = change.item;
      const found = findItemByIdentifier([payload.id, payload.name], currentInventory, false, true);
      const item = Array.isArray(found) ? null : found;
      if (item) {
        const oldCopy = { ...item };
        const renameOnly =
          payload.newName === undefined &&
          payload.name !== undefined &&
          payload.name !== item.name;
        const finalName = payload.newName ?? (renameOnly ? payload.name : undefined);
        const updated = updateItemCore(item, payload);
        if (finalName && finalName.trim() !== '' && finalName !== item.name) {
          updated.name = finalName;
        }
        record = { type: 'update', oldItem: oldCopy, newItem: updated };
      }
    } else {
      const payload = change.item;
      const found = findItemByIdentifier([payload.id, payload.name], currentInventory, false, true);
      const item = Array.isArray(found) ? null : found;
      if (item) {
        const oldCopy = { ...item };
        let updated: Item = { ...item };
        if (payload.chapters && payload.chapters.length > 0) {
          updated = { ...updated, chapters: [...(item.chapters ?? []), ...payload.chapters] };
        }
        if (payload.tags && payload.tags.length > 0) {
          const set = new Set(item.tags ?? []);
          for (const t of payload.tags) set.add(t);
          updated.tags = Array.from(set);
        }
        if (payload.knownUses && payload.knownUses.length > 0) {
          const ku = [...(item.knownUses ?? [])];
          for (const u of payload.knownUses) {
            const iKu = ku.findIndex(k => k.actionName === u.actionName);
            if (iKu !== -1) ku[iKu] = u;
            else ku.push(u);
          }
          updated.knownUses = ku;
        }
        record = { type: 'update', oldItem: oldCopy, newItem: updated };
      }
    }
    if (record) records.push(record);
  }
  return records;
};

export const applyAllItemChanges = (
  itemChanges: Array<ItemChange>,
  currentInventory: Array<Item>,
): Array<Item> => {
  let inv = [...currentInventory];
  for (const change of itemChanges) inv = applyItemChangeAction(inv, change);
  return inv;
};
