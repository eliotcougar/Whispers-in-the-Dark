/**
 * @file services/storage.ts
 * @description Helper functions for persisting game state to browser localStorage.
 */

import { DebugPacket, GameStateStack, DebugPacketStack, GameSettings, ThemePackName, ThinkingEffort } from '../types';
import {
  LOCAL_STORAGE_SAVE_KEY,
  LOCAL_STORAGE_DEBUG_KEY,
  LOCAL_STORAGE_DEBUG_LORE_KEY,
  LOCAL_STORAGE_SETTINGS_KEY,
  DEFAULT_ENABLED_THEME_PACKS,
} from '../constants';
import {
  prepareGameStateStackForSavingWithoutImages,
  expandSavedStackToFullStates,
  normalizeLoadedSaveDataStack,
} from './saveLoad';
import { attachImageRefsFromDb } from './imageDb';
import { safeParseJson } from '../utils/jsonUtils';

/** Saves the current game state to localStorage. */
export const saveGameStateToLocalStorage = (
  stack: GameStateStack,
  onError?: (message: string) => void,
): boolean => {
  try {
    const dataToSave = prepareGameStateStackForSavingWithoutImages(stack);
    localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(dataToSave));
    return true;
  } catch (error: unknown) {
    console.error('Error saving game state to localStorage:', error);
    const message =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || (error as { code?: unknown }).code === 22)
        ? 'Could not save game: Browser storage is full. Please clear some space or try saving to a file.'
        : 'An unexpected error occurred while trying to automatically save your game.';
    if (onError) onError(message);
    return false;
  }
};

/**
 * Loads the latest saved game from localStorage if available.
 * Handles version conversion and validation steps.
 */
export const loadGameStateFromLocalStorage = (): GameStateStack | null => {
  try {
    const savedDataString = localStorage.getItem(LOCAL_STORAGE_SAVE_KEY);
    if (!savedDataString) return null;

    const parsedData: unknown = safeParseJson(savedDataString);
    if (parsedData === null) {
      console.warn('Saved data found in localStorage could not be parsed as JSON.');
      return null;
    }
    if (typeof parsedData !== 'object') {
      console.warn('Saved data found in localStorage is not an object.');
      return null;
    }

    const processed = normalizeLoadedSaveDataStack(parsedData as Record<string, unknown>, 'localStorage');
    if (processed) {
      return expandSavedStackToFullStates(processed);
    }
    console.warn('Local save data is invalid or version mismatch for V3. Starting new game.');
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_DEBUG_KEY);
    return null;
  } catch (error: unknown) {
    console.error('Error loading game state from localStorage:', error);
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_DEBUG_KEY);
    return null;
  }
};

export const loadGameStateFromLocalStorageWithImages = async (): Promise<GameStateStack | null> => {
  const loaded = loadGameStateFromLocalStorage();
  if (!loaded) return null;
  const [current, previous] = loaded;
  const withImagesCurrent = await attachImageRefsFromDb(current);
  const withImagesPrevious = previous ? await attachImageRefsFromDb(previous) : undefined;
  return [withImagesCurrent, withImagesPrevious];
};

const isValidThinkingEffort = (val: unknown): val is ThinkingEffort =>
  val === 'Low' || val === 'Medium' || val === 'High';

const isValidThemePackArray = (packs: unknown): packs is Array<ThemePackName> =>
  Array.isArray(packs) && packs.every(p => typeof p === 'string');

export const saveSettingsToLocalStorage = (settings: GameSettings): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error: unknown) {
    console.error('Error saving settings to localStorage:', error);
  }
};

export const loadSettingsFromLocalStorage = (): GameSettings => {
  const defaults: GameSettings = {
    enabledThemePacks: [...DEFAULT_ENABLED_THEME_PACKS],
    thinkingEffort: 'Medium',
  };
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (!saved) {
      return { ...defaults };
    }
    const parsed: unknown = safeParseJson(saved);
    if (!parsed || typeof parsed !== 'object') {
      console.warn('Saved settings found in localStorage could not be parsed.');
      return { ...defaults };
    }
    const merged: GameSettings = { ...defaults };
    if (
      isValidThemePackArray(
        (parsed as { enabledThemePacks?: unknown }).enabledThemePacks,
      )
    ) {
      merged.enabledThemePacks = [
        ...(parsed as { enabledThemePacks: Array<ThemePackName> }).enabledThemePacks,
      ];
    }
    if (
      isValidThinkingEffort(
        (parsed as { thinkingEffort?: unknown }).thinkingEffort,
      )
    ) {
      merged.thinkingEffort = (parsed as {
        thinkingEffort: ThinkingEffort;
      }).thinkingEffort;
    }
    return merged;
  } catch (error: unknown) {
    console.error('Error loading settings from localStorage:', error);
    localStorage.removeItem(LOCAL_STORAGE_SETTINGS_KEY);
    return { ...defaults };
  }
};

export const saveDebugPacketStackToLocalStorage = (
  stack: DebugPacketStack,
): void => {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_DEBUG_KEY,
      JSON.stringify(stack),
    );
  } catch (error: unknown) {
    console.error('Error saving debug packet stack to localStorage:', error);
  }
};

export const loadDebugPacketStackFromLocalStorage = (): DebugPacketStack | null => {
  try {
    const savedDataString = localStorage.getItem(LOCAL_STORAGE_DEBUG_KEY);
    if (!savedDataString) return null;
    const parsedData: unknown = safeParseJson(savedDataString);
    if (Array.isArray(parsedData)) {
      const [current, previous] = parsedData as Array<DebugPacket | null>;
      return [current ?? null, previous ?? null];
    }
    if (parsedData && typeof parsedData === 'object') {
      return [parsedData as DebugPacket, null];
    }
    console.warn('Saved debug stack found in localStorage could not be parsed.');
    return null;
  } catch (error: unknown) {
    console.error('Error loading debug packet stack from localStorage:', error);
    localStorage.removeItem(LOCAL_STORAGE_DEBUG_KEY);
    return null;
  }
};

export interface DebugLoreStorageData {
  debugLore: boolean;
  debugGoodFacts: Array<string>;
  debugBadFacts: Array<string>;
}

export const saveDebugLoreToLocalStorage = (
  data: DebugLoreStorageData,
): void => {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_DEBUG_LORE_KEY,
      JSON.stringify(data),
    );
  } catch (error: unknown) {
    console.error('Error saving debug lore state to localStorage:', error);
  }
};

export const loadDebugLoreFromLocalStorage = (): DebugLoreStorageData | null => {
  try {
    const savedDataString = localStorage.getItem(LOCAL_STORAGE_DEBUG_LORE_KEY);
    if (!savedDataString) return null;
    const parsed: unknown = safeParseJson(savedDataString);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as { debugLore?: unknown }).debugLore !== 'boolean'
    ) {
      console.warn(
        'Saved debug lore data found in localStorage could not be parsed.',
      );
      return null;
    }
    const good = Array.isArray((parsed as { debugGoodFacts?: unknown }).debugGoodFacts)
      ? [...(parsed as { debugGoodFacts: Array<string> }).debugGoodFacts]
      : [];
    const bad = Array.isArray((parsed as { debugBadFacts?: unknown }).debugBadFacts)
      ? [...(parsed as { debugBadFacts: Array<string> }).debugBadFacts]
      : [];
    return {
      debugLore: (parsed as { debugLore: boolean }).debugLore,
      debugGoodFacts: good,
      debugBadFacts: bad,
    };
  } catch (error: unknown) {
    console.error('Error loading debug lore state from localStorage:', error);
    localStorage.removeItem(LOCAL_STORAGE_DEBUG_LORE_KEY);
    return null;
  }
};

export const clearDebugLoreFromLocalStorage = (): void => {
  try {
    localStorage.removeItem(LOCAL_STORAGE_DEBUG_LORE_KEY);
  } catch (error: unknown) {
    console.error('Error clearing debug lore from localStorage:', error);
  }
};

