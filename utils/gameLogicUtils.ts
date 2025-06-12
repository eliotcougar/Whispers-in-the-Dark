


/**
 * @file gameLogicUtils.ts
 * @description This file contains utility functions for core game logic operations,
 * including inventory management, log management, theme selection, and processing
 * changes to game entities like items and characters.
 */

import {
  Item, ItemChange, ItemReference, GiveItemPayload, AdventureTheme, Character,
  ItemChangeRecord, CharacterChangeRecord,
  ValidCharacterUpdatePayload, ValidNewCharacterPayload
} from '../types';
import { buildCharacterId, buildItemId, findItemByIdentifier } from './entityUtils';
import { PLAYER_HOLDER_ID } from '../constants';

/**
 * Core helper for manipulating items between holders. All item-related actions
 * ultimately use this function. The resulting action is determined by the
 * combination of `fromId`, `toId`, and the provided payload.
 */
const applyItemActionCore = (
  currentInventory: Item[],
  fromId: string | null,
  toId: string | null,
  payload: Item | ItemReference | GiveItemPayload,
): Item[] => {
  let newInventory = [...currentInventory];

  if (fromId === null && toId === PLAYER_HOLDER_ID) {
    // Gain new item. If an item with the same id or name exists elsewhere,
    // treat this as taking that item (transfer) rather than duplicating it.
    const itemData = payload as Item;
    const existing = findItemByIdentifier([itemData.id, itemData.name], newInventory, false, true) as Item | null;

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
        knownUses: itemData.knownUses || existing.knownUses || [],
        holderId: PLAYER_HOLDER_ID,
      };
      newInventory[idx] = updated;
      return newInventory;
    }

    const id = existing ? existing.id : (itemData as Partial<Item>).id || buildItemId(itemData.name);
    const finalItem: Item = {
      id,
      name: itemData.name,
      type: itemData.type,
      description: itemData.description,
      activeDescription: itemData.activeDescription,
      isActive: itemData.isActive ?? false,
      isJunk: itemData.isJunk ?? false,
      knownUses: itemData.knownUses || [],
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
    // Put new item elsewhere (no player animation)
    const itemData = payload as Item;
    const existing = findItemByIdentifier([itemData.id, itemData.name], newInventory, false, true) as Item | null;
    const id = existing ? existing.id : (itemData as Partial<Item>).id || buildItemId(itemData.name);
    const finalItem: Item = {
      id,
      name: itemData.name,
      type: itemData.type,
      description: itemData.description,
      activeDescription: itemData.activeDescription,
      isActive: itemData.isActive ?? false,
      isJunk: itemData.isJunk ?? false,
      knownUses: itemData.knownUses || [],
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
    // Lose item
    const ref = payload as ItemReference;
    const itemToRemove = findItemByIdentifier([ref.id, ref.name], newInventory, false, true) as Item | null;
    if (itemToRemove) newInventory = newInventory.filter(i => i.id !== itemToRemove.id);
    return newInventory;
  }

  if (fromId !== null && toId !== null && fromId === toId) {
    // Update item in-place
    const updatePayload = payload as Item;
    const existingItem = findItemByIdentifier([updatePayload.id, updatePayload.name], newInventory, false, true) as Item | null;
    if (!existingItem) {
      const identifierForLog = updatePayload.id || updatePayload.name || 'unknown';
      console.warn(`applyItemActionCore ('update'): Item "${identifierForLog}" not found in inventory.`);
      return newInventory;
    }
    const idx = newInventory.findIndex(i => i.id === existingItem.id);
    const updated: Item = { ...existingItem };
    (payload as Item).id = existingItem.id;
    if (updatePayload.type !== undefined) updated.type = updatePayload.type;
    if (updatePayload.description !== undefined) updated.description = updatePayload.description;
    if (updatePayload.activeDescription !== undefined) {
      updated.activeDescription = updatePayload.activeDescription === null ? undefined : updatePayload.activeDescription;
    }
    if (updatePayload.isActive !== undefined) updated.isActive = updatePayload.isActive;
    if (updatePayload.isJunk !== undefined) updated.isJunk = updatePayload.isJunk;
    if (updatePayload.knownUses !== undefined) updated.knownUses = updatePayload.knownUses;
    if (updatePayload.holderId !== undefined && updatePayload.holderId.trim() !== '') {
      updated.holderId = updatePayload.holderId;
    }
    if (updatePayload.addKnownUse) {
      const currentUses = updated.knownUses ? [...updated.knownUses] : [];
      const kuIndex = currentUses.findIndex(ku => ku.actionName === updatePayload.addKnownUse!.actionName);
      if (kuIndex !== -1) currentUses[kuIndex] = updatePayload.addKnownUse;
      else currentUses.push(updatePayload.addKnownUse);
      updated.knownUses = currentUses;
    }
    if (updatePayload.newName && updatePayload.newName.trim() !== '' && updatePayload.newName !== existingItem.name) {
      updated.name = updatePayload.newName;
    }
    newInventory[idx] = updated;
    return newInventory;
  }

  if (fromId && toId && fromId !== toId) {
    // Give item from one holder to another
    const givePayload = payload as GiveItemPayload;
    if (!givePayload.toId || !givePayload.fromId) {
      console.warn('applyItemActionCore ("give"): Missing fromId or toId.', givePayload);
      return newInventory;
    }
    const itemToMove = findItemByIdentifier([givePayload.id, givePayload.name], newInventory, false, true) as Item | null;
    if (!itemToMove) {
      console.warn(`applyItemActionCore ('give'): Item not found for transfer.`);
      return newInventory;
    }
    if (itemToMove.holderId !== givePayload.fromId) {
      console.warn(`applyItemActionCore ('give'): Source holder mismatch for item ${itemToMove.name}.`);
    }
    const idx = newInventory.findIndex(i => i.id === itemToMove.id);
    newInventory[idx] = { ...itemToMove, holderId: givePayload.toId };
    return newInventory;
  }

  console.warn('applyItemActionCore: Unrecognized parameters', { fromId, toId, payload });
  return newInventory;
};

export const gainItem = (inv: Item[], item: Item): Item[] =>
  applyItemActionCore(inv, null, PLAYER_HOLDER_ID, item);

export const putItem = (inv: Item[], item: Item): Item[] =>
  applyItemActionCore(inv, null, item.holderId, item);

export const loseItem = (inv: Item[], ref: ItemReference): Item[] =>
  applyItemActionCore(inv, PLAYER_HOLDER_ID, null, ref);

export const updateItem = (inv: Item[], item: Item): Item[] =>
  applyItemActionCore(inv, item.holderId, item.holderId, item);

export const giveItem = (inv: Item[], payload: GiveItemPayload): Item[] =>
  applyItemActionCore(inv, payload.fromId, payload.toId, payload);

export const takeItem = (inv: Item[], payload: GiveItemPayload): Item[] =>
  applyItemActionCore(inv, payload.fromId, payload.toId, payload);

/**
 * Applies a single item change action to the current inventory.
 * Assumes `currentInventory` and `itemChange` (and its `.item` payload) are ALREADY VALIDATED by the parser.
 * Additionally, for 'update' and 'destroy' actions, the item name is guaranteed to be present in `currentInventory`.
 *
 * @param currentInventory - The current array of items in the player's inventory.
 * @param itemChange - The item change object received from the AI, specifying the action and item.
 * @returns A new array representing the updated inventory.
*/
export const applyItemChangeAction = (currentInventory: Item[], itemChange: ItemChange): Item[] => {
  switch (itemChange.action) {
    case "gain":
      return gainItem(currentInventory, itemChange.item as Item);
    case "put":
      return putItem(currentInventory, itemChange.item as Item);
    case "give":
      return giveItem(currentInventory, itemChange.item as GiveItemPayload);
    case "take":
      return takeItem(currentInventory, itemChange.item as GiveItemPayload);
    case "destroy":
      return loseItem(currentInventory, itemChange.item as ItemReference);
    case "update":
      return updateItem(currentInventory, itemChange.item as Item);
    default:
      return currentInventory;
  }
};

/**
 * Adds a new message to a list of log messages, ensuring the list does not exceed a maximum size.
 *
 * @param currentLog - The current array of log messages.
 * @param message - The new message string to add.
 * @param maxLogMessages - The maximum number of messages to retain in the log.
 * @returns A new array of log messages with the new message added and older messages potentially removed.
 */
export const addLogMessageToList = (
  currentLog: string[],
  message: string,
  maxLogMessages: number
): string[] => {
  const newLog = [...currentLog, message];
  return newLog.length > maxLogMessages
    ? newLog.slice(newLog.length - maxLogMessages)
    : newLog;
};

/**
 * Selects the name of the next theme for a reality shift.
 * It attempts to avoid selecting the current theme if multiple themes are available.
 *
 * @param availableThemes - An array of all `AdventureTheme` objects available for selection.
 * @param currentThemeName - Optional. The name of the currently active theme.
 * @returns The name of the selected theme, or `null` if no themes are available.
 */
export const selectNextThemeName = (
  availableThemes: AdventureTheme[],
  currentThemeName?: string | null
): string | null => {
  if (availableThemes.length === 0) {
    return null;
  }
  const filteredThemes = currentThemeName && availableThemes.length > 1
    ? availableThemes.filter(theme => theme.name !== currentThemeName)
    : availableThemes;
  const themesToChooseFrom = filteredThemes.length > 0 ? filteredThemes : availableThemes;
  const randomIndex = Math.floor(Math.random() * themesToChooseFrom.length);
  return themesToChooseFrom[randomIndex].name;
};

/**
 * Builds an array of `ItemChangeRecord` objects from a list of `ItemChange` objects and the current inventory state.
 * The records detail what was gained, lost, or how an item was updated.
 *
 * @param itemChanges - An array of `ItemChange` objects, typically from an AI response (assumed to be validated).
 * @param currentInventory - The player's inventory array *before* these `itemChanges` are applied.
 * @returns An array of `ItemChangeRecord` objects.
 */
export const buildItemChangeRecords = (
  itemChanges: ItemChange[],
  currentInventory: Item[] 
): ItemChangeRecord[] => {
  const records: ItemChangeRecord[] = [];

  for (const change of itemChanges) {
    if (change.item === null || change.item === undefined) continue;

    const itemPayload = change.item;
    let record: ItemChangeRecord | null = null;

    if (change.action === 'gain' && typeof itemPayload === 'object' && itemPayload !== null && 'name' in itemPayload) {
      const gainedItemData = itemPayload as Item;
      if (!gainedItemData.id) {
        gainedItemData.id = buildItemId(gainedItemData.name);
      }
      const existing = findItemByIdentifier([gainedItemData.id, gainedItemData.name], currentInventory, false, true) as Item | null;
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
          knownUses: gainedItemData.knownUses || [],
          holderId: gainedItemData.holderId,
        };
        record = { type: 'gain', gainedItem: cleanGainedItem };
      }
    } else if ((change.action === 'give' || change.action === 'take') && typeof itemPayload === 'object') {
      const givePayload = itemPayload as GiveItemPayload;
      const oldItem = findItemByIdentifier([givePayload.id, givePayload.name], currentInventory, false, true) as Item | null;
      if (oldItem) {
        const oldItemCopy = { ...oldItem };
        const newItemData: Item = { ...oldItemCopy, holderId: givePayload.toId };
        record = { type: 'update', oldItem: oldItemCopy, newItem: newItemData };
      }
    } else if (change.action === 'destroy') {
      const ref = itemPayload as ItemReference;
      const lostItem = findItemByIdentifier([ref.id, ref.name], currentInventory, false, true) as Item | null;
      if (lostItem) record = { type: 'loss', lostItem: { ...lostItem } };
    } else if (change.action === 'update' && typeof itemPayload === 'object' && itemPayload !== null && 'name' in itemPayload) {
      const updatePayload = itemPayload as Item;
      const oldItem = findItemByIdentifier([updatePayload.id, updatePayload.name], currentInventory, false, true) as Item | null;

      if (oldItem) {
        const oldItemCopy = { ...oldItem };
        itemPayload.id = oldItemCopy.id;
        const newItemData: Item = {
          id: oldItemCopy.id,
          name: updatePayload.newName || oldItemCopy.name,
          type: updatePayload.type !== undefined ? updatePayload.type : oldItemCopy.type,
          description: updatePayload.description !== undefined ? updatePayload.description : oldItemCopy.description,
          activeDescription: updatePayload.activeDescription !== undefined ? (updatePayload.activeDescription === null ? undefined : updatePayload.activeDescription) : oldItemCopy.activeDescription,
          isActive: updatePayload.isActive !== undefined ? updatePayload.isActive : (oldItemCopy.isActive ?? false),
          isJunk: updatePayload.isJunk !== undefined ? updatePayload.isJunk : (oldItemCopy.isJunk ?? false),
          knownUses: Array.isArray(updatePayload.knownUses) ? updatePayload.knownUses : (oldItemCopy.knownUses || []),
          holderId: updatePayload.holderId !== undefined && updatePayload.holderId.trim() !== '' ? updatePayload.holderId : oldItemCopy.holderId,
        };
        if (updatePayload.addKnownUse) {
          const currentKnownUses = [...(newItemData.knownUses || [])];
          const kuIndex = currentKnownUses.findIndex(ku => ku.actionName === updatePayload.addKnownUse!.actionName);
          if (kuIndex !== -1) currentKnownUses[kuIndex] = updatePayload.addKnownUse;
          else currentKnownUses.push(updatePayload.addKnownUse);
          newItemData.knownUses = currentKnownUses;
        }
        record = { type: 'update', oldItem: oldItemCopy, newItem: newItemData };
      }
    }
    if (record) records.push(record);
  }
  return records;
};

/**
 * Applies a list of `ItemChange` objects to the current inventory.
 *
 * @param itemChanges - An array of `ItemChange` objects to apply.
 * @param currentInventory - The current inventory array.
 * @returns A new array representing the inventory after all changes have been applied.
 */
export const applyAllItemChanges = (
  itemChanges: ItemChange[],
  currentInventory: Item[]
): Item[] => {
  let newInventory = [...currentInventory];
  for (const change of itemChanges) {
    if (change.item === null || change.item === undefined) continue; 
    newInventory = applyItemChangeAction(newInventory, change);
  }
  return newInventory;
};


/**
 * Builds an array of `CharacterChangeRecord` objects from lists of character additions and updates.
 * Payloads are assumed to be validated by the parser.
 *
 * @param charactersAddedFromAI - Array of validated new character payloads.
 * @param charactersUpdatedFromAI - Array of validated character update payloads.
 * @param currentThemeName - The name of the current theme.
 * @param currentAllCharacters - The list of all characters *before* these changes are applied.
 * @returns An array of `CharacterChangeRecord` objects.
 */
export const buildCharacterChangeRecords = (
  charactersAddedFromAI: ValidNewCharacterPayload[],
  charactersUpdatedFromAI: ValidCharacterUpdatePayload[],
  currentThemeName: string,
  currentAllCharacters: Character[] 
): CharacterChangeRecord[] => {
  const records: CharacterChangeRecord[] = [];
  (charactersAddedFromAI || []).forEach(cAdd => {
    const newChar: Character = {
      ...cAdd,
      id: buildCharacterId(cAdd.name),
      themeName: currentThemeName,
      aliases: cAdd.aliases || [],
      presenceStatus: cAdd.presenceStatus || 'unknown',
      lastKnownLocation: cAdd.lastKnownLocation === undefined ? null : cAdd.lastKnownLocation,
      preciseLocation: cAdd.preciseLocation === undefined ? null : cAdd.preciseLocation,
      dialogueSummaries: [], // Initialize dialogueSummaries
    };
    records.push({ type: 'add', characterName: newChar.name, addedCharacter: newChar });
  });

  (charactersUpdatedFromAI || []).forEach(cUpdate => {
    const oldChar = currentAllCharacters.find(c => c.name === cUpdate.name && c.themeName === currentThemeName);
    if (oldChar) {
      const newCharData: Character = { ...oldChar, dialogueSummaries: oldChar.dialogueSummaries || [] }; // Preserve summaries
      if (cUpdate.newDescription !== undefined) newCharData.description = cUpdate.newDescription;
      if (cUpdate.newAliases !== undefined) newCharData.aliases = cUpdate.newAliases;
      if (cUpdate.addAlias) {
        newCharData.aliases = Array.from(new Set([...(newCharData.aliases || []), cUpdate.addAlias]));
      }
      if (cUpdate.newPresenceStatus !== undefined) newCharData.presenceStatus = cUpdate.newPresenceStatus;
      if (cUpdate.newLastKnownLocation !== undefined) newCharData.lastKnownLocation = cUpdate.newLastKnownLocation;
      if (cUpdate.newPreciseLocation !== undefined) newCharData.preciseLocation = cUpdate.newPreciseLocation;
      
      if (newCharData.presenceStatus === 'distant' || newCharData.presenceStatus === 'unknown') {
        newCharData.preciseLocation = null;
      } else if ((newCharData.presenceStatus === 'nearby' || newCharData.presenceStatus === 'companion') && newCharData.preciseLocation === null) {
         newCharData.preciseLocation = newCharData.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      records.push({ type: 'update', characterName: cUpdate.name, oldCharacter: { ...oldChar }, newCharacter: newCharData });
    }
  });
  return records;
};

/**
 * Applies character additions and updates to the list of all known characters.
 * Payloads are assumed to be validated by the parser.
 *
 * @param charactersAddedFromAI - Array of validated new character payloads.
 * @param charactersUpdatedFromAI - Array of validated character update payloads.
 * @param currentThemeName - The name of the current theme.
 * @param currentAllCharacters - The current list of all known characters.
 * @returns A new array representing the updated list of all characters.
 */
export const applyAllCharacterChanges = (
  charactersAddedFromAI: ValidNewCharacterPayload[],
  charactersUpdatedFromAI: ValidCharacterUpdatePayload[],
  currentThemeName: string,
  currentAllCharacters: Character[]
): Character[] => {
  const newAllCharacters = [...currentAllCharacters];
  (charactersAddedFromAI || []).forEach(cAdd => {
    if (!newAllCharacters.some(c => c.name === cAdd.name && c.themeName === currentThemeName)) {
      const newChar: Character = {
        ...cAdd,
        id: buildCharacterId(cAdd.name),
        themeName: currentThemeName,
        aliases: cAdd.aliases || [],
        presenceStatus: cAdd.presenceStatus || 'unknown',
        lastKnownLocation: cAdd.lastKnownLocation === undefined ? null : cAdd.lastKnownLocation,
        preciseLocation: cAdd.preciseLocation === undefined ? null : cAdd.preciseLocation,
        dialogueSummaries: [], // Initialize dialogueSummaries
      };
      if (newChar.presenceStatus === 'distant' || newChar.presenceStatus === 'unknown') {
        newChar.preciseLocation = null;
      }
      newAllCharacters.push(newChar);
    }
  });

  (charactersUpdatedFromAI || []).forEach(cUpdate => {
    const idx = newAllCharacters.findIndex(c => c.name === cUpdate.name && c.themeName === currentThemeName);
    if (idx !== -1) {
      const charToUpdate: Character = { ...newAllCharacters[idx], dialogueSummaries: newAllCharacters[idx].dialogueSummaries || [] }; // Preserve summaries
      if (cUpdate.newDescription !== undefined) charToUpdate.description = cUpdate.newDescription;
      if (cUpdate.newAliases !== undefined) charToUpdate.aliases = cUpdate.newAliases;
      if (cUpdate.addAlias) {
        charToUpdate.aliases = Array.from(new Set([...(charToUpdate.aliases || []), cUpdate.addAlias]));
      }
      if (cUpdate.newPresenceStatus !== undefined) charToUpdate.presenceStatus = cUpdate.newPresenceStatus;
      if (cUpdate.newLastKnownLocation !== undefined) charToUpdate.lastKnownLocation = cUpdate.newLastKnownLocation;
      if (cUpdate.newPreciseLocation !== undefined) charToUpdate.preciseLocation = cUpdate.newPreciseLocation;

      if (charToUpdate.presenceStatus === 'distant' || charToUpdate.presenceStatus === 'unknown') {
        charToUpdate.preciseLocation = null;
      } else if ((charToUpdate.presenceStatus === 'nearby' || charToUpdate.presenceStatus === 'companion') && charToUpdate.preciseLocation === null) {
         charToUpdate.preciseLocation = charToUpdate.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      newAllCharacters[idx] = charToUpdate;
    }
  });
  return newAllCharacters;
};
