/**
 * @file services/storage.ts
 * @description Helper functions for persisting game state to browser localStorage.
 */

import { FullGameState } from '../types';
import {
  LOCAL_STORAGE_SAVE_KEY,
  
} from '../constants';
import {
  prepareGameStateForSaving,
  expandSavedDataToFullState,
  normalizeLoadedSaveData,
} from './saveLoadService';

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

    const processed = normalizeLoadedSaveData(parsedData as Record<string, unknown>, 'localStorage');
    if (processed) {
      return expandSavedDataToFullState(processed);
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

