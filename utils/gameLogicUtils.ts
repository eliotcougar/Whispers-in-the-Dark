


/**
 * @file gameLogicUtils.ts
 * @description This file contains utility functions for core game logic operations,
 * including inventory management, log management, theme selection, and processing
 * changes to game entities like items and characters.
 */

import {
  Item, ItemChange, AdventureTheme, Character,
  ItemChangeRecord, CharacterChangeRecord,
  ValidCharacterUpdatePayload, ValidNewCharacterPayload
} from '../types';

/**
 * Applies a single item change action to the current inventory.
 * Assumes `currentInventory` and `itemChange` (and its `.item` payload) are ALREADY VALIDATED by the parser.
 * Additionally, for 'update' and 'lose' actions, the item name is guaranteed to be present in `currentInventory`.
 *
 * @param currentInventory - The current array of items in the player's inventory.
 * @param itemChange - The item change object received from the AI, specifying the action and item.
 * @returns A new array representing the updated inventory.
 */
export const applyItemChangeAction = (currentInventory: Item[], itemChange: ItemChange): Item[] => {
  let newInventory = [...currentInventory];
  const { item: itemPayloadFromChange, action } = itemChange;

  if (action === 'gain') {
    const newItemFromAI = itemPayloadFromChange as Item;
    const newItemToAdd: Item = {
        name: newItemFromAI.name,
        type: newItemFromAI.type,
        description: newItemFromAI.description,
        activeDescription: newItemFromAI.activeDescription,
        isActive: newItemFromAI.isActive ?? false,
        isJunk: newItemFromAI.isJunk ?? false,
        knownUses: newItemFromAI.knownUses || [] 
      };
    const existingItemIndex = newInventory.findIndex(i => i.name === newItemToAdd.name);
    if (existingItemIndex !== -1) {
      newInventory[existingItemIndex] = newItemToAdd; 
    } else {
      newInventory.push(newItemToAdd); 
    }
  } else if (action === 'lose') {
    const itemName = itemPayloadFromChange as string;
    newInventory = newInventory.filter(i => i.name !== itemName);
  } else if (action === 'update') {
    const updatePayload = itemPayloadFromChange as Item;
    const originalName = updatePayload.name; 

    const itemIndexInNewInventory = newInventory.findIndex(i => i.name === originalName);
    if (itemIndexInNewInventory === -1) { // Should not happen if validated upstream
        console.warn(`applyItemChangeAction ('update'): Item "${originalName}" not found in inventory for update.`);
        return newInventory; // Return original inventory if item to update isn't found
    }
    
    const existingItem = newInventory[itemIndexInNewInventory];
    const updatedItem: Item = { ...existingItem };

    if (updatePayload.type !== undefined) updatedItem.type = updatePayload.type;
    if (updatePayload.description !== undefined) updatedItem.description = updatePayload.description;
    
    if (updatePayload.activeDescription !== undefined) {
      updatedItem.activeDescription = updatePayload.activeDescription === null ? undefined : updatePayload.activeDescription;
    }
    
    if (updatePayload.isActive !== undefined) updatedItem.isActive = updatePayload.isActive;
    if (updatePayload.isJunk !== undefined) updatedItem.isJunk = updatePayload.isJunk;
    
    if (updatePayload.knownUses !== undefined) {
      updatedItem.knownUses = updatePayload.knownUses;
    }

    if (updatePayload.addKnownUse) {
      const currentKnownUses = updatedItem.knownUses ? [...updatedItem.knownUses] : [];
      const kuIndex = currentKnownUses.findIndex(ku => ku.actionName === updatePayload.addKnownUse!.actionName);
      if (kuIndex !== -1) currentKnownUses[kuIndex] = updatePayload.addKnownUse; 
      else currentKnownUses.push(updatePayload.addKnownUse); 
      updatedItem.knownUses = currentKnownUses;
    }

    if (updatePayload.newName && updatePayload.newName.trim() !== '' && updatePayload.newName !== originalName) {
      updatedItem.name = updatePayload.newName;
    }
    
    newInventory[itemIndexInNewInventory] = updatedItem;
  }
  return newInventory;
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
      const gainedItemData = itemPayload;
      const cleanGainedItem: Item = {
        name: gainedItemData.name, type: gainedItemData.type, description: gainedItemData.description,
        activeDescription: gainedItemData.activeDescription,
        isActive: gainedItemData.isActive ?? false,
        isJunk: gainedItemData.isJunk ?? false,
        knownUses: gainedItemData.knownUses || []
      };
      record = { type: 'gain', gainedItem: cleanGainedItem };
    } else if (change.action === 'lose' && typeof itemPayload === 'string') {
      const itemName = itemPayload;
      const lostItem = currentInventory.find(i => i.name === itemName);
      if (lostItem) record = { type: 'loss', lostItem: { ...lostItem } }; 
    } else if (change.action === 'update' && typeof itemPayload === 'object' && itemPayload !== null && 'name' in itemPayload) {
      const updatePayload = itemPayload;
      const originalItemName = updatePayload.name;
      const oldItem = currentInventory.find(i => i.name === originalItemName);

      if (oldItem) {
        const oldItemCopy = { ...oldItem }; 
        const newItemData: Item = {
          name: updatePayload.newName || oldItemCopy.name,
          type: updatePayload.type !== undefined ? updatePayload.type : oldItemCopy.type,
          description: updatePayload.description !== undefined ? updatePayload.description : oldItemCopy.description,
          activeDescription: updatePayload.activeDescription !== undefined ? (updatePayload.activeDescription === null ? undefined : updatePayload.activeDescription) : oldItemCopy.activeDescription,
          isActive: updatePayload.isActive !== undefined ? updatePayload.isActive : (oldItemCopy.isActive ?? false),
          isJunk: updatePayload.isJunk !== undefined ? updatePayload.isJunk : (oldItemCopy.isJunk ?? false),
          knownUses: Array.isArray(updatePayload.knownUses) ? updatePayload.knownUses : (oldItemCopy.knownUses || []),
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
