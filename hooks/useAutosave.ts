/**
 * @file useAutosave.ts
 * @description Provides debounced autosave functionality for App.
 */
import { useEffect, useRef } from 'react';
import { FullGameState } from '../types';
import {
  saveGameStateToLocalStorage,
  saveDebugPacketToLocalStorage,
} from '../services/storage';

export const AUTOSAVE_DEBOUNCE_TIME = 1500;

export interface UseAutosaveOptions {
  readonly gatherCurrentGameState: () => FullGameState;
  readonly isLoading: boolean;
  readonly hasGameBeenInitialized: boolean;
  readonly appReady: boolean;
  readonly dialogueState: unknown;
  readonly dependencies: Array<unknown>;
  readonly setError?: (msg: string | null) => void;
}

export function useAutosave({
  gatherCurrentGameState,
  isLoading,
  hasGameBeenInitialized,
  appReady,
  dialogueState,
  dependencies,
  setError,
}: UseAutosaveOptions) {
  const autosaveTimeoutRef = useRef<number | null>(null);

  const dependenciesKey = JSON.stringify(dependencies);

  useEffect(() => {
    if (isLoading || !hasGameBeenInitialized || !appReady || !!dialogueState) {
      return;
    }
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      const gameStateToSave = gatherCurrentGameState();
      saveGameStateToLocalStorage(
        gameStateToSave,
        setError ? (msg) => { setError(msg); } : undefined,
      );
      saveDebugPacketToLocalStorage(gameStateToSave.lastDebugPacket);
    }, AUTOSAVE_DEBOUNCE_TIME);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    gatherCurrentGameState,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    dependenciesKey,
    setError,
  ]);
}
