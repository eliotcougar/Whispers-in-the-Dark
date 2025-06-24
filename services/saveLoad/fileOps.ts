/**
 * @file fileOps.ts
 * @description Helpers for saving to and loading from external files.
 */
import { GameStateStack } from '../../types';
import { CURRENT_SAVE_GAME_VERSION } from '../../constants';
import { safeParseJson } from '../../utils/jsonUtils';
import {
  prepareGameStateStackForSaving,
  expandSavedStackToFullStates,
  normalizeLoadedSaveDataStack,
} from './migrations';

const triggerDownload = (data: string, filename: string, type: string): void => {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const saveGameStateToFile = (
  stack: GameStateStack,
  onError?: (message: string) => void,
): boolean => {
  try {
    const dataToSave = prepareGameStateStackForSaving(stack);
    const jsonString = JSON.stringify(dataToSave, null, 2);
    triggerDownload(jsonString, `WhispersInTheDark_Save_V${CURRENT_SAVE_GAME_VERSION}_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    return true;
  } catch (error: unknown) {
    console.error('Error saving game state to file:', error);
    if (onError) onError('An error occurred while preparing your game data for download.');
    return false;
  }
};

export const loadGameStateFromFile = async (file: File): Promise<GameStateStack | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (event.target && typeof event.target.result === 'string') {
          const parsedData: unknown = safeParseJson(event.target.result);
          if (parsedData === null) {
            resolve(null);
            return;
          }
          const processed = normalizeLoadedSaveDataStack(parsedData as Record<string, unknown>, 'file');
          if (processed) {
            resolve(expandSavedStackToFullStates(processed));
            return;
          }
        }
        console.warn('File save data is invalid or version mismatch for V3. Not loading.');
        resolve(null);
      } catch (error: unknown) {
        console.error('Error loading game state from file:', error);
        resolve(null);
      }
    };
    reader.onerror = () => {
      console.error('Error reading file.');
      resolve(null);
    };
    reader.readAsText(file);
  });
};
