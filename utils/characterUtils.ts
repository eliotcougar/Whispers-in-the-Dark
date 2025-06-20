/**
 * @file characterUtils.ts
 * @description Helper functions for character change tracking.
 */

import {
  Character,
  CharacterChangeRecord,
  ValidCharacterUpdatePayload,
  ValidNewCharacterPayload,
} from '../types';
import { buildCharacterId } from './entityUtils';

export const buildCharacterChangeRecords = (
  charactersAddedFromAI: Array<ValidNewCharacterPayload>,
  charactersUpdatedFromAI: Array<ValidCharacterUpdatePayload>,
  currentThemeName: string,
  currentAllCharacters: Array<Character>,
): Array<CharacterChangeRecord> => {
  const records: Array<CharacterChangeRecord> = [];
  charactersAddedFromAI.forEach(cAdd => {
    const newChar: Character = {
      ...cAdd,
      id: buildCharacterId(cAdd.name),
      themeName: currentThemeName,
      aliases: cAdd.aliases ?? [],
      presenceStatus: cAdd.presenceStatus ?? 'unknown',
      lastKnownLocation: cAdd.lastKnownLocation ?? null,
      preciseLocation: cAdd.preciseLocation ?? null,
      dialogueSummaries: [],
    };
    records.push({ type: 'add', characterName: newChar.name, addedCharacter: newChar });
  });

  charactersUpdatedFromAI.forEach(cUpdate => {
    const oldChar = currentAllCharacters.find(
      c => c.name === cUpdate.name && c.themeName === currentThemeName,
    );
    if (oldChar) {
      const newCharData: Character = { ...oldChar, dialogueSummaries: oldChar.dialogueSummaries ?? [] };
      if (cUpdate.newDescription !== undefined) newCharData.description = cUpdate.newDescription;
      if (cUpdate.newAliases !== undefined) newCharData.aliases = cUpdate.newAliases;
      if (cUpdate.addAlias) {
        newCharData.aliases = Array.from(new Set([...(newCharData.aliases ?? []), cUpdate.addAlias]));
      }
      if (cUpdate.newPresenceStatus !== undefined) newCharData.presenceStatus = cUpdate.newPresenceStatus;
      if (cUpdate.newLastKnownLocation !== undefined) newCharData.lastKnownLocation = cUpdate.newLastKnownLocation;
      if (cUpdate.newPreciseLocation !== undefined) newCharData.preciseLocation = cUpdate.newPreciseLocation;

      if (newCharData.presenceStatus === 'distant' || newCharData.presenceStatus === 'unknown') {
        newCharData.preciseLocation = null;
      } else {
        newCharData.preciseLocation ??=
          newCharData.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      records.push({
        type: 'update',
        characterName: cUpdate.name,
        oldCharacter: { ...oldChar },
        newCharacter: newCharData,
      });
    }
  });
  return records;
};

export const applyAllCharacterChanges = (
  charactersAddedFromAI: Array<ValidNewCharacterPayload>,
  charactersUpdatedFromAI: Array<ValidCharacterUpdatePayload>,
  currentThemeName: string,
  currentAllCharacters: Array<Character>,
): Array<Character> => {
  const newAllCharacters = [...currentAllCharacters];
  charactersAddedFromAI.forEach(cAdd => {
    if (!newAllCharacters.some(c => c.name === cAdd.name && c.themeName === currentThemeName)) {
      const newChar: Character = {
        ...cAdd,
        id: buildCharacterId(cAdd.name),
        themeName: currentThemeName,
        aliases: cAdd.aliases ?? [],
        presenceStatus: cAdd.presenceStatus ?? 'unknown',
        lastKnownLocation: cAdd.lastKnownLocation ?? null,
        preciseLocation: cAdd.preciseLocation ?? null,
        dialogueSummaries: [],
      };
      if (newChar.presenceStatus === 'distant' || newChar.presenceStatus === 'unknown') {
        newChar.preciseLocation = null;
      }
      newAllCharacters.push(newChar);
    }
  });

  charactersUpdatedFromAI.forEach(cUpdate => {
    const idx = newAllCharacters.findIndex(
      c => c.name === cUpdate.name && c.themeName === currentThemeName,
    );
    if (idx !== -1) {
      const charToUpdate: Character = {
        ...newAllCharacters[idx],
        dialogueSummaries: newAllCharacters[idx].dialogueSummaries ?? [],
      };
      if (cUpdate.newDescription !== undefined) charToUpdate.description = cUpdate.newDescription;
      if (cUpdate.newAliases !== undefined) charToUpdate.aliases = cUpdate.newAliases;
      if (cUpdate.addAlias) {
        charToUpdate.aliases = Array.from(
          new Set([...(charToUpdate.aliases ?? []), cUpdate.addAlias]),
        );
      }
      if (cUpdate.newPresenceStatus !== undefined) charToUpdate.presenceStatus = cUpdate.newPresenceStatus;
      if (cUpdate.newLastKnownLocation !== undefined) charToUpdate.lastKnownLocation = cUpdate.newLastKnownLocation;
      if (cUpdate.newPreciseLocation !== undefined) charToUpdate.preciseLocation = cUpdate.newPreciseLocation;

      if (charToUpdate.presenceStatus === 'distant' || charToUpdate.presenceStatus === 'unknown') {
        charToUpdate.preciseLocation = null;
      } else {
        charToUpdate.preciseLocation ??=
          charToUpdate.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      newAllCharacters[idx] = charToUpdate;
    }
  });
  return newAllCharacters;
};
