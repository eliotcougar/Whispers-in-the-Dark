/**
 * @file saveSnapshotHelpers.ts
 * @description Utilities for creating save-ready game state snapshots.
 */
import { FullGameState } from '../types';
import { CURRENT_SAVE_GAME_VERSION } from '../constants';

export interface BuildSaveStateOptions {
  currentState: FullGameState;
}

/**
 * Generate a sanitized snapshot of the game state for saving.
 */
export const buildSaveStateSnapshot = (
  options: BuildSaveStateOptions,
): FullGameState => {
  const { currentState } = options;

  return {
    ...currentState,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    mapData: currentState.mapData,
    currentMapNodeId: currentState.currentMapNodeId,
    destinationNodeId: currentState.destinationNodeId,
    mapLayoutConfig: currentState.mapLayoutConfig,
    mapViewBox: currentState.mapViewBox,
    globalTurnNumber: currentState.globalTurnNumber,
    currentTheme: currentState.currentTheme,
  };
};
