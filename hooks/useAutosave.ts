/**
 * @file useAutosave.ts
 * @description Provides debounced autosave functionality for App.
 */
import { useEffect, useRef } from 'react';
import { GameStateStack } from '../types';
import {
  saveGameStateToLocalStorage,
  saveDebugPacketToLocalStorage,
  saveDebugLoreToLocalStorage,
} from '../services/storage';

export const AUTOSAVE_DEBOUNCE_TIME = 1500;

export interface UseAutosaveOptions {
  readonly gatherGameStateStack: () => GameStateStack;
  readonly isLoading: boolean;
  readonly hasGameBeenInitialized: boolean;
  readonly appReady: boolean;
  readonly dialogueState: unknown;
  readonly dependencies: Array<unknown>;
  readonly setError?: (msg: string | null) => void;
}

export function useAutosave({
  gatherGameStateStack,
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
      const gameStateStack = gatherGameStateStack();
      saveGameStateToLocalStorage(
        gameStateStack,
        setError ? (msg) => { setError(msg); } : undefined,
      );
      saveDebugPacketToLocalStorage(gameStateStack[0].lastDebugPacket);
      saveDebugLoreToLocalStorage({
        debugLore: gameStateStack[0].debugLore,
        debugGoodFacts: gameStateStack[0].debugGoodFacts,
        debugBadFacts: gameStateStack[0].debugBadFacts,
      });
    }, AUTOSAVE_DEBOUNCE_TIME);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [
    gatherGameStateStack,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    dependenciesKey,
    setError,
  ]);
}
