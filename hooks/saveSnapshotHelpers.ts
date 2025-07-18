/**
 * @file saveSnapshotHelpers.ts
 * @description Utilities for creating save-ready game state snapshots.
 */
import { FullGameState, ThemePackName } from '../types';
import { CURRENT_SAVE_GAME_VERSION } from '../constants';

export interface BuildSaveStateOptions {
  currentState: FullGameState;
  playerGender: string;
  enabledThemePacks: Array<ThemePackName>;
  stabilityLevel: number;
  chaosLevel: number;
}

/**
 * Generate a sanitized snapshot of the game state for saving.
 */
export const buildSaveStateSnapshot = (
  options: BuildSaveStateOptions,
): FullGameState => {
  const {
    currentState,
    playerGender,
    enabledThemePacks,
    stabilityLevel,
    chaosLevel,
  } = options;

  return {
    ...currentState,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    playerGender,
    enabledThemePacks,
    stabilityLevel,
    chaosLevel,
    mapData: currentState.mapData,
    currentMapNodeId: currentState.currentMapNodeId,
    destinationNodeId: currentState.destinationNodeId,
    mapLayoutConfig: currentState.mapLayoutConfig,
    mapViewBox: currentState.mapViewBox,
    isCustomGameMode: currentState.isCustomGameMode,
    isAwaitingManualShiftThemeSelection: currentState.isAwaitingManualShiftThemeSelection,
    globalTurnNumber: currentState.globalTurnNumber,
    currentThemeObject: currentState.currentThemeObject,
  };
};
