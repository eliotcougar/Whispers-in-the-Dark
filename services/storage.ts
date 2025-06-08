/**
 * @file services/storage.ts
 * @description Helper functions for persisting game state to browser localStorage.
 */

import { FullGameState, SavedGameDataShape, Item } from '../types';
import {
  CURRENT_SAVE_GAME_VERSION,
  LOCAL_STORAGE_SAVE_KEY,
  DEFAULT_STABILITY_LEVEL,
  DEFAULT_CHAOS_LEVEL,
  DEFAULT_ENABLED_THEME_PACKS,
  DEFAULT_PLAYER_GENDER
} from '../constants';
import { prepareGameStateForSaving, expandSavedDataToFullState, validateSavedGameState } from './saveLoadService';
import { ensureCompleteMapLayoutConfig, ensureCompleteMapNodeDataDefaults } from './saveLoadService';
import { findThemeByName } from './themeUtils';

/** Saves the current game state to localStorage. */
export const saveGameStateToLocalStorage = (gameState: FullGameState): boolean => {
  try {
    const dataToSave = prepareGameStateForSaving(gameState);
    localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(dataToSave));
    return true;
  } catch (error) {
    console.error('Error saving game state to localStorage:', error);
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || (error as { code?: unknown }).code === 22)) {
      alert('Could not save game: Browser storage is full. Please clear some space or try saving to a file.');
    } else {
      alert('An unexpected error occurred while trying to automatically save your game.');
    }
    return false;
  }
};

/**
 * Loads the latest saved game from localStorage if available.
 * Handles version conversion and validation steps.
 */
export const loadGameStateFromLocalStorage = (): FullGameState | null => {
  try {
    const savedDataString = localStorage.getItem(LOCAL_STORAGE_SAVE_KEY);
    if (!savedDataString) return null;

    const parsedData: unknown = JSON.parse(savedDataString);
    if (typeof parsedData !== 'object' || parsedData === null) {
      console.warn('Saved data found in localStorage is not an object.');
      return null;
    }

    const parsedObj = parsedData as Record<string, unknown>;

    let dataToValidateAndExpand: SavedGameDataShape | null = null;

    if (
      parsedObj &&
      (parsedObj.saveGameVersion === CURRENT_SAVE_GAME_VERSION ||
        (typeof parsedObj.saveGameVersion === 'string' && parsedObj.saveGameVersion.startsWith(CURRENT_SAVE_GAME_VERSION.split('.')[0])))
    ) {
      if (parsedObj.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
        console.warn(`Potentially compatible future V${CURRENT_SAVE_GAME_VERSION.split('.')[0]}.x save version '${String(parsedObj.saveGameVersion)}' from localStorage. Attempting to treat as current version (V3) for validation.`);
      }
      dataToValidateAndExpand = parsedObj as SavedGameDataShape;
      ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
      ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
    } else if (parsedObj) {
      console.warn(`Unknown save version '${String(parsedObj.saveGameVersion)}' from localStorage. This might fail validation.`);
      dataToValidateAndExpand = parsedObj as SavedGameDataShape;
      if (dataToValidateAndExpand) {
        ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
        ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
      }
    }

    if (dataToValidateAndExpand && !dataToValidateAndExpand.currentThemeObject && dataToValidateAndExpand.currentThemeName) {
      dataToValidateAndExpand.currentThemeObject = findThemeByName(dataToValidateAndExpand.currentThemeName);
      if (!dataToValidateAndExpand.currentThemeObject) {
        console.warn(`Failed to find theme "${dataToValidateAndExpand.currentThemeName}" during localStorage load. Game state might be incomplete.`);
      }
    }

    if (dataToValidateAndExpand) {
      const gtRaw = (parsedObj as { globalTurnNumber?: unknown }).globalTurnNumber;
      if (typeof gtRaw === 'string') {
        const parsed = parseInt(gtRaw, 10);
        dataToValidateAndExpand.globalTurnNumber = isNaN(parsed) ? 0 : parsed;
      } else if (gtRaw === undefined || gtRaw === null) {
        dataToValidateAndExpand.globalTurnNumber = 0;
      }
    }

    if (dataToValidateAndExpand && validateSavedGameState(dataToValidateAndExpand)) {
      dataToValidateAndExpand.inventory = dataToValidateAndExpand.inventory.map((item: Item) => ({ ...item, isJunk: item.isJunk ?? false }));
      dataToValidateAndExpand.score = dataToValidateAndExpand.score ?? 0;
      dataToValidateAndExpand.stabilityLevel = dataToValidateAndExpand.stabilityLevel ?? DEFAULT_STABILITY_LEVEL;
      dataToValidateAndExpand.chaosLevel = dataToValidateAndExpand.chaosLevel ?? DEFAULT_CHAOS_LEVEL;
      dataToValidateAndExpand.localTime = dataToValidateAndExpand.localTime ?? null;
      dataToValidateAndExpand.localEnvironment = dataToValidateAndExpand.localEnvironment ?? null;
      dataToValidateAndExpand.localPlace = dataToValidateAndExpand.localPlace ?? null;
      dataToValidateAndExpand.allCharacters = dataToValidateAndExpand.allCharacters.map((c) => ({
        ...c,
        aliases: c.aliases || [],
        presenceStatus: c.presenceStatus || 'unknown',
        lastKnownLocation: c.lastKnownLocation ?? null,
        preciseLocation: c.preciseLocation || null,
        dialogueSummaries: c.dialogueSummaries || [],
      }));
      dataToValidateAndExpand.enabledThemePacks = dataToValidateAndExpand.enabledThemePacks ?? [...DEFAULT_ENABLED_THEME_PACKS];
      dataToValidateAndExpand.playerGender = dataToValidateAndExpand.playerGender ?? DEFAULT_PLAYER_GENDER;
      dataToValidateAndExpand.turnsSinceLastShift = dataToValidateAndExpand.turnsSinceLastShift ?? 0;
      dataToValidateAndExpand.globalTurnNumber = dataToValidateAndExpand.globalTurnNumber ?? 0;
      dataToValidateAndExpand.mainQuest = dataToValidateAndExpand.mainQuest ?? null;
      dataToValidateAndExpand.isCustomGameMode = dataToValidateAndExpand.isCustomGameMode ?? false;

      return expandSavedDataToFullState(dataToValidateAndExpand);
    }
    console.warn('Local save data is invalid or version mismatch for V3. Starting new game.');
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
    return null;
  } catch (error) {
    console.error('Error loading game state from localStorage:', error);
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
    return null;
  }
};

