/**
 * @file inventoryUtils.ts
 * @description Helper functions for inventory actions and change tracking.
 */

import {
  Item,
  ItemChapter,
  ItemChange,
  ItemReference,
  MoveItemPayload,
  ItemChangePayload,
  ItemChangeRecord,
} from '../types';
import { buildItemId, findItemByIdentifier } from './entityUtils';
import { PLAYER_HOLDER_ID } from '../constants';

const applyItemActionCore = (
  currentInventory: Array<Item>,
  fromId: string | null,
  toId: string | null,
  payload: Item | ItemReference | MoveItemPayload | ItemChangePayload,
): Array<Item> => {
  let newInventory = [...currentInventory];

  if (fromId === null && toId === PLAYER_HOLDER_ID) {
    const itemData = payload as Item & {
      contentLength?: number;
      actualContent?: string;
      visibleContent?: string;
      imageData?: string;
    };
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
        tags: itemData.tags ?? existing.tags ?? [],
        chapters:
          itemData.chapters ??
          (itemData.type === 'page'
            ? [
                {
                  heading: itemData.name,
                  description: itemData.description,
                contentLength:
                  (itemData as { contentLength?: number }).contentLength ??
                  existing.chapters?.[0]?.contentLength ??
                  30,
                actualContent:
                  (itemData as { actualContent?: string }).actualContent ??
                  existing.chapters?.[0]?.actualContent,
                visibleContent:
                  (itemData as { visibleContent?: string }).visibleContent ??
                  existing.chapters?.[0]?.visibleContent,
                imageData:
                  (itemData as { imageData?: string }).imageData ??
                  existing.chapters?.[0]?.imageData,
              },
              ]
            : existing.chapters),
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
      tags: itemData.tags ?? [],
      chapters:
        itemData.chapters ??
        (itemData.type === 'page'
          ? [
              { 
                heading: itemData.name,
                description: itemData.description,
                contentLength:
                  (itemData as { contentLength?: number }).contentLength ?? 30,
                actualContent:
                  (itemData as { actualContent?: string }).actualContent,
                visibleContent:
                  (itemData as { visibleContent?: string }).visibleContent,
                imageData: (itemData as { imageData?: string }).imageData,
              },
            ]
          : undefined),
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
    const itemData = payload as Item & {
      contentLength?: number;
      actualContent?: string;
      visibleContent?: string;
      imageData?: string;
    };
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
      tags: itemData.tags ?? [],
      chapters:
        itemData.chapters ??
        (itemData.type === 'page'
          ? [
              {
                heading: itemData.name,
                description: itemData.description,
                contentLength:
                  (itemData as { contentLength?: number }).contentLength ?? 30,
                actualContent:
                  (itemData as { actualContent?: string }).actualContent,
                visibleContent:
                  (itemData as { visibleContent?: string }).visibleContent,
                imageData: (itemData as { imageData?: string }).imageData,
              },
            ]
          : undefined),
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

  if (fromId === toId) {
    const updatePayload = payload as Partial<Omit<Item, 'activeDescription'>> & {
      activeDescription?: string | null;
      contentLength?: number;
      actualContent?: string;
      visibleContent?: string;
      imageData?: string;
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
    if (updatePayload.tags !== undefined) updated.tags = updatePayload.tags;
    if (updatePayload.chapters !== undefined) updated.chapters = updatePayload.chapters;
    if (updatePayload.contentLength !== undefined && updated.chapters) {
      const ch = updated.chapters[0];
      updated.chapters[0] = { ...ch, contentLength: updatePayload.contentLength };
    }
    if (updatePayload.actualContent !== undefined && updated.chapters) {
      const ch = updated.chapters[0];
      updated.chapters[0] = { ...ch, actualContent: updatePayload.actualContent };
    }
    if (updatePayload.visibleContent !== undefined && updated.chapters) {
      const ch = updated.chapters[0];
      updated.chapters[0] = { ...ch, visibleContent: updatePayload.visibleContent };
    }
    if (updatePayload.imageData !== undefined && updated.chapters) {
      const ch = updated.chapters[0];
      updated.chapters[0] = { ...ch, imageData: updatePayload.imageData };
    }
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
  const givePayload = payload as MoveItemPayload;
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

export const updateItem = (
  inv: Array<Item>,
  item: ItemChangePayload,
): Array<Item> =>
  applyItemActionCore(inv, item.holderId ?? null, item.holderId ?? null, item);

export const giveItem = (inv: Array<Item>, payload: MoveItemPayload): Array<Item> =>
  applyItemActionCore(inv, payload.fromId, payload.toId, payload);

export const takeItem = (inv: Array<Item>, payload: MoveItemPayload): Array<Item> =>
  applyItemActionCore(inv, payload.fromId, payload.toId, payload);

export const applyItemChangeAction = (
  currentInventory: Array<Item>,
  itemChange: ItemChange,
): Array<Item> => {
  switch (itemChange.action) {
    case 'create':
      return itemChange.item.holderId === PLAYER_HOLDER_ID
        ? gainItem(currentInventory, itemChange.item)
        : putItem(currentInventory, itemChange.item);
    case 'move':
      return giveItem(currentInventory, itemChange.item);
    case 'destroy':
      return loseItem(currentInventory, itemChange.item);
    case 'change':
      return updateItem(currentInventory, itemChange.item);
    case 'addDetails': {
      const { item } = itemChange;
      const ref: ItemReference = { id: item.id, name: item.name };
      const target = findItemByIdentifier(
        [ref.id, ref.name],
        currentInventory,
        false,
        true,
      ) as Item | null;
      if (!target) {
        console.warn(`applyItemChangeAction ('addDetails'): Item not found.`);
        return currentInventory;
      }
      const idx = currentInventory.findIndex(i => i.id === target.id);
      const updated: Item = {
        ...target,
        chapters: [...(target.chapters ?? []), item.chapter],
        lastInspectTurn: undefined,
      };
      const newInventory = [...currentInventory];
      newInventory[idx] = updated;
      return newInventory;
    }
    default:
      return currentInventory;
  }
};

export const buildItemChangeRecords = (
  itemChanges: Array<ItemChange>,
  currentInventory: Array<Item>,
): Array<ItemChangeRecord> => {
  const records: Array<ItemChangeRecord> = [];

  for (let idx = 0; idx < itemChanges.length; idx++) {
    const change = itemChanges[idx];
    let record: ItemChangeRecord | null = null;

    if (change.action === 'create') {
      const gainedItemData = change.item;
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
        // Rewrite invalid "gain" to a transfer from the current holder
        const newChange: ItemChange = {
          action: 'move',
          item: {
            id: existing.id,
            name: existing.name,
            fromId: existing.holderId,
            toId: PLAYER_HOLDER_ID,
          },
        };
        itemChanges[idx] = newChange;
        record = { type: 'update', oldItem: oldItemCopy, newItem: newItemData };
      } else {
        // Normalize to ensure gained item has complete data
        itemChanges[idx] = { action: 'create', item: gainedItemData };
        const cleanGainedItem: Item = {
          id: gainedItemData.id,
          name: gainedItemData.name,
          type: gainedItemData.type,
          description: gainedItemData.description,
          activeDescription: gainedItemData.activeDescription,
          isActive: gainedItemData.isActive ?? false,
          tags: gainedItemData.tags ?? [],
          chapters:
            gainedItemData.chapters ??
            (gainedItemData.type === 'page'
              ? [
                  {
                heading: gainedItemData.name,
                description: gainedItemData.description,
                contentLength:
                  (gainedItemData as { contentLength?: number }).contentLength ?? 30,
                actualContent:
                  (gainedItemData as { actualContent?: string }).actualContent,
                visibleContent:
                  (gainedItemData as { visibleContent?: string }).visibleContent,
                imageData: (gainedItemData as { imageData?: string }).imageData,
              },
                ]
              : undefined),
          knownUses: gainedItemData.knownUses ?? [],
          holderId: gainedItemData.holderId,
        };
        record = { type: 'gain', gainedItem: cleanGainedItem };
      }
    } else if (change.action === 'move') {
      const givePayload = change.item;
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
      const ref = change.item;
      const lostItem = findItemByIdentifier(
        [ref.id, ref.name],
        currentInventory,
        false,
        true,
      ) as Item | null;
      if (lostItem) record = { type: 'loss', lostItem: { ...lostItem } };
    } else if (change.action === 'change') {
      const updatePayload: ItemChangePayload & {
        contentLength?: number;
        actualContent?: string;
        visibleContent?: string;
        imageData?: string;
      } = change.item;
      const oldItem = findItemByIdentifier(
        [updatePayload.id, updatePayload.name],
        currentInventory,
        false,
        true,
      ) as Item | null;

      if (oldItem) {
        const oldItemCopy = { ...oldItem };
        // Fill missing id so the update can be applied
        updatePayload.id = oldItemCopy.id;
        const renameOnly =
          updatePayload.name !== undefined &&
          updatePayload.newName === undefined &&
          updatePayload.name !== oldItemCopy.name;

        let finalName = oldItemCopy.name;
        if (updatePayload.newName !== undefined) {
          finalName = updatePayload.newName;
        } else if (renameOnly && updatePayload.name !== undefined) {
          // Only rename if both id and name match but newName is missing
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
          tags: updatePayload.tags ?? (oldItemCopy.tags ?? []),
          chapters:
            updatePayload.chapters ??
            oldItemCopy.chapters ??
            ((updatePayload.type ?? oldItemCopy.type) === 'page'
              ? [
                  {
                    heading: finalName,
                    description: updatePayload.description ?? oldItemCopy.description,
                    contentLength:
                      updatePayload.contentLength ??
                      (oldItemCopy.chapters?.[0] as ItemChapter | undefined)?.contentLength ??
                      30,
                    actualContent:
                      updatePayload.actualContent ??
                      (oldItemCopy.chapters?.[0] as ItemChapter | undefined)?.actualContent,
                    visibleContent:
                      updatePayload.visibleContent ??
                      (oldItemCopy.chapters?.[0] as ItemChapter | undefined)?.visibleContent,
                    imageData:
                      updatePayload.imageData ??
                      (oldItemCopy.chapters?.[0] as ItemChapter | undefined)?.imageData,
                  },
                ]
              : undefined),
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
    } else if (change.action === 'addDetails') {
      const { item } = change;
      const oldItem = findItemByIdentifier(
        [item.id, item.name],
        currentInventory,
        false,
        true,
      ) as Item | null;
      if (oldItem) {
        const oldItemCopy = { ...oldItem };
        const newItemData: Item = {
          ...oldItem,
          chapters: [...(oldItem.chapters ?? []), item.chapter],
        };
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
    newInventory = applyItemChangeAction(newInventory, change);
  }
  return newInventory;
};
