/**
 * @file inventoryUtils.ts
 * @description Helper functions for inventory actions and change tracking.
 */

import {
  Item,
  ItemChange,
  ItemReference,
  GiveItemPayload,
  ItemChangeRecord,
} from '../types';
import { buildItemId, findItemByIdentifier } from './entityUtils';
import { PLAYER_HOLDER_ID } from '../constants';

const applyItemActionCore = (
  currentInventory: Array<Item>,
  fromId: string | null,
  toId: string | null,
  payload: Item | ItemReference | GiveItemPayload,
): Array<Item> => {
  let newInventory = [...currentInventory];

  if (fromId === null && toId === PLAYER_HOLDER_ID) {
    const itemData = payload as Item;
    const existing = findItemByIdentifier(
      [itemData.id, itemData.name],
      newInventory,
      false,
      true,
    ) as Item | null;

    if (existing && existing.holderId !== PLAYER_HOLDER_ID) {
      const idx = newInventory.findIndex(i => i.id === existing.id);
      const updated: Item = {
        ...existing,
        name: itemData.name,
        type: itemData.type,
        description: itemData.description,
        activeDescription: itemData.activeDescription,
        isActive: itemData.isActive ?? existing.isActive ?? false,
        isJunk: itemData.isJunk ?? existing.isJunk ?? false,
        knownUses: itemData.knownUses ?? existing.knownUses ?? [],
        holderId: PLAYER_HOLDER_ID,
      };
      newInventory[idx] = updated;
      return newInventory;
    }

    const id = existing
      ? existing.id
      : (itemData as Partial<Item>).id ?? buildItemId(itemData.name);
    const finalItem: Item = {
      id,
      name: itemData.name,
      type: itemData.type,
      description: itemData.description,
      activeDescription: itemData.activeDescription,
      isActive: itemData.isActive ?? false,
      isJunk: itemData.isJunk ?? false,
      knownUses: itemData.knownUses ?? [],
      holderId: PLAYER_HOLDER_ID,
    };
    if (existing) {
      const idx = newInventory.findIndex(i => i.id === existing.id);
      newInventory[idx] = finalItem;
    } else {
      newInventory.push(finalItem);
    }
    return newInventory;
  }

  if (fromId === null && toId) {
    const itemData = payload as Item;
    const existing = findItemByIdentifier(
      [itemData.id, itemData.name],
      newInventory,
      false,
      true,
    ) as Item | null;
    const id = existing
      ? existing.id
      : (itemData as Partial<Item>).id ?? buildItemId(itemData.name);
    const finalItem: Item = {
      id,
      name: itemData.name,
      type: itemData.type,
      description: itemData.description,
      activeDescription: itemData.activeDescription,
      isActive: itemData.isActive ?? false,
      isJunk: itemData.isJunk ?? false,
      knownUses: itemData.knownUses ?? [],
      holderId: toId,
    };
    if (existing) {
      const idx = newInventory.findIndex(i => i.id === existing.id);
      newInventory[idx] = finalItem;
    } else {
      newInventory.push(finalItem);
    }
    return newInventory;
  }

  if (fromId === PLAYER_HOLDER_ID && toId === null) {
    const ref = payload as ItemReference;
    const itemToRemove = findItemByIdentifier(
      [ref.id, ref.name],
      newInventory,
      false,
      true,
    ) as Item | null;
    if (itemToRemove)
      newInventory = newInventory.filter(i => i.id !== itemToRemove.id);
    return newInventory;
  }

  if (fromId !== null && toId !== null && fromId === toId) {
    const updatePayload = payload as Partial<Omit<Item, 'activeDescription'>> & {
      activeDescription?: string | null;
    };
    const existingItem = findItemByIdentifier(
      [updatePayload.id, updatePayload.name],
      newInventory,
      false,
      true,
    ) as Item | null;
    if (!existingItem) {
      const identifierForLog = updatePayload.id ?? updatePayload.name ?? 'unknown';
      console.warn(
        `applyItemActionCore ('update'): Item "${identifierForLog}" not found in inventory.`,
      );
      return newInventory;
    }
    const idx = newInventory.findIndex(i => i.id === existingItem.id);
    const updated: Item = { ...existingItem };
    (payload as Item).id = existingItem.id;
    if (updatePayload.type !== undefined) updated.type = updatePayload.type;
    if (updatePayload.description !== undefined)
      updated.description = updatePayload.description;
    if (updatePayload.activeDescription !== undefined) {
      updated.activeDescription = updatePayload.activeDescription ?? undefined;
    }
    if (updatePayload.isActive !== undefined) updated.isActive = updatePayload.isActive;
    if (updatePayload.isJunk !== undefined) updated.isJunk = updatePayload.isJunk;
    if (updatePayload.knownUses !== undefined) updated.knownUses = updatePayload.knownUses;
    if (updatePayload.holderId !== undefined && updatePayload.holderId.trim() !== '') {
      updated.holderId = updatePayload.holderId;
    }
    if (updatePayload.addKnownUse) {
      const { addKnownUse } = updatePayload;
      const currentUses = [...(updated.knownUses ?? [])];
      const kuIndex = currentUses.findIndex(ku => ku.actionName === addKnownUse.actionName);
      if (kuIndex !== -1) currentUses[kuIndex] = addKnownUse;
      else currentUses.push(addKnownUse);
      updated.knownUses = currentUses;
    }
    const renameOnly =
      !!updatePayload.id &&
      !!updatePayload.name &&
      updatePayload.newName === undefined &&
      updatePayload.name !== existingItem.name;
    const finalName = updatePayload.newName ?? (renameOnly ? updatePayload.name : undefined);
    if (finalName && finalName.trim() !== '' && finalName !== existingItem.name) {
      updated.name = finalName;
    }
    newInventory[idx] = updated;
    return newInventory;
  }

  if (fromId && toId && fromId !== toId) {
    const givePayload = payload as GiveItemPayload;
    if (!givePayload.toId || !givePayload.fromId) {
      console.warn('applyItemActionCore ("give"): Missing fromId or toId.', givePayload);
      return newInventory;
    }
    const itemToMove = findItemByIdentifier(
      [givePayload.id, givePayload.name],
      newInventory,
      false,
      true,
    ) as Item | null;
    if (!itemToMove) {
      console.warn(`applyItemActionCore ('give'): Item not found for transfer.`);
      return newInventory;
    }
    if (itemToMove.holderId !== givePayload.fromId) {
      console.warn(
        `applyItemActionCore ('give'): Source holder mismatch for item ${itemToMove.name}.`,
      );
    }
    const idx = newInventory.findIndex(i => i.id === itemToMove.id);
    newInventory[idx] = { ...itemToMove, holderId: givePayload.toId };
    return newInventory;
  }

  console.warn('applyItemActionCore: Unrecognized parameters', { fromId, toId, payload });
  return newInventory;
};

export const gainItem = (inv: Array<Item>, item: Item): Array<Item> =>
  applyItemActionCore(inv, null, PLAYER_HOLDER_ID, item);

export const putItem = (inv: Array<Item>, item: Item): Array<Item> =>
  applyItemActionCore(inv, null, item.holderId, item);

export const loseItem = (inv: Array<Item>, ref: ItemReference): Array<Item> =>
  applyItemActionCore(inv, PLAYER_HOLDER_ID, null, ref);

export const updateItem = (inv: Array<Item>, item: Item): Array<Item> =>
  applyItemActionCore(inv, item.holderId, item.holderId, item);

export const giveItem = (inv: Array<Item>, payload: GiveItemPayload): Array<Item> =>
  applyItemActionCore(inv, payload.fromId, payload.toId, payload);

export const takeItem = (inv: Array<Item>, payload: GiveItemPayload): Array<Item> =>
  applyItemActionCore(inv, payload.fromId, payload.toId, payload);

export const applyItemChangeAction = (
  currentInventory: Array<Item>,
  itemChange: ItemChange,
): Array<Item> => {
  switch (itemChange.action) {
    case 'gain':
      return gainItem(currentInventory, itemChange.item as Item);
    case 'put':
      return putItem(currentInventory, itemChange.item as Item);
    case 'give':
      return giveItem(currentInventory, itemChange.item as GiveItemPayload);
    case 'take':
      return takeItem(currentInventory, itemChange.item as GiveItemPayload);
    case 'destroy':
      return loseItem(currentInventory, itemChange.item as ItemReference);
    case 'update':
      return updateItem(currentInventory, itemChange.item as Item);
    default:
      return currentInventory;
  }
};

export const buildItemChangeRecords = (
  itemChanges: Array<ItemChange>,
  currentInventory: Array<Item>,
): Array<ItemChangeRecord> => {
  const records: Array<ItemChangeRecord> = [];

  for (const change of itemChanges) {
    if (change.item === null) continue;

    const itemPayload = change.item;
    let record: ItemChangeRecord | null = null;

    if (change.action === 'gain') {
      const gainedItemData = itemPayload as Item;
      if (!gainedItemData.id) {
        gainedItemData.id = buildItemId(gainedItemData.name);
      }
      const existing = findItemByIdentifier(
        [gainedItemData.id, gainedItemData.name],
        currentInventory,
        false,
        true,
      ) as Item | null;
      if (existing && existing.holderId !== PLAYER_HOLDER_ID) {
        const oldItemCopy = { ...existing };
        const newItemData: Item = { ...oldItemCopy, holderId: PLAYER_HOLDER_ID };
        change.item = {
          id: existing.id,
          name: existing.name,
          fromId: existing.holderId,
          toId: PLAYER_HOLDER_ID,
        } as unknown as GiveItemPayload;
        change.action = 'give';
        record = { type: 'update', oldItem: oldItemCopy, newItem: newItemData };
      } else {
        change.item = gainedItemData;
        const cleanGainedItem: Item = {
          id: gainedItemData.id,
          name: gainedItemData.name,
          type: gainedItemData.type,
          description: gainedItemData.description,
          activeDescription: gainedItemData.activeDescription,
          isActive: gainedItemData.isActive ?? false,
          isJunk: gainedItemData.isJunk ?? false,
          knownUses: gainedItemData.knownUses ?? [],
          holderId: gainedItemData.holderId,
        };
        record = { type: 'gain', gainedItem: cleanGainedItem };
      }
    } else if ((change.action === 'give' || change.action === 'take') && typeof itemPayload === 'object') {
      const givePayload = itemPayload as GiveItemPayload;
      const oldItem = findItemByIdentifier(
        [givePayload.id, givePayload.name],
        currentInventory,
        false,
        true,
      ) as Item | null;
      if (oldItem) {
        const oldItemCopy = { ...oldItem };
        const newItemData: Item = { ...oldItemCopy, holderId: givePayload.toId };
        record = { type: 'update', oldItem: oldItemCopy, newItem: newItemData };
      }
    } else if (change.action === 'destroy') {
      const ref = itemPayload as ItemReference;
      const lostItem = findItemByIdentifier(
        [ref.id, ref.name],
        currentInventory,
        false,
        true,
      ) as Item | null;
      if (lostItem) record = { type: 'loss', lostItem: { ...lostItem } };
    } else if (change.action === 'update') {
      const updatePayload = itemPayload as Partial<Omit<Item, 'activeDescription'>> & {
        activeDescription?: string | null;
      };
      const oldItem = findItemByIdentifier(
        [updatePayload.id, updatePayload.name],
        currentInventory,
        false,
        true,
      ) as Item | null;

      if (oldItem) {
        const oldItemCopy = { ...oldItem };
        itemPayload.id = oldItemCopy.id;
        const renameOnly =
          updatePayload.id !== undefined &&
          updatePayload.name !== undefined &&
          updatePayload.newName === undefined &&
          updatePayload.name !== oldItemCopy.name;

        let finalName = oldItemCopy.name;
        if (updatePayload.newName !== undefined) {
          finalName = updatePayload.newName;
        } else if (renameOnly && updatePayload.name !== undefined) {
          finalName = updatePayload.name;
        }

        const newItemData: Item = {
          id: oldItemCopy.id,
          name: finalName,
          type: updatePayload.type ?? oldItemCopy.type,
          description: updatePayload.description ?? oldItemCopy.description,
          activeDescription:
            updatePayload.activeDescription === null
              ? undefined
              : updatePayload.activeDescription ?? oldItemCopy.activeDescription,
          isActive: updatePayload.isActive ?? (oldItemCopy.isActive ?? false),
          isJunk: updatePayload.isJunk ?? (oldItemCopy.isJunk ?? false),
          knownUses: Array.isArray(updatePayload.knownUses)
            ? updatePayload.knownUses
            : oldItemCopy.knownUses ?? [],
          holderId:
            updatePayload.holderId !== undefined && updatePayload.holderId.trim() !== ''
              ? updatePayload.holderId
              : oldItemCopy.holderId,
        };
        if (updatePayload.addKnownUse) {
          const { addKnownUse } = updatePayload;
          const currentKnownUses = [...(newItemData.knownUses ?? [])];
          const kuIndex = currentKnownUses.findIndex(ku => ku.actionName === addKnownUse.actionName);
          if (kuIndex !== -1) currentKnownUses[kuIndex] = addKnownUse;
          else currentKnownUses.push(addKnownUse);
          newItemData.knownUses = currentKnownUses;
        }
        record = { type: 'update', oldItem: oldItemCopy, newItem: newItemData };
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
  let newInventory = [...currentInventory];
  for (const change of itemChanges) {
    if (change.item === null) continue;
    newInventory = applyItemChangeAction(newInventory, change);
  }
  return newInventory;
};
