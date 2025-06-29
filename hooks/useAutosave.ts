/**
 * @file useAutosave.ts
 * @description Provides debounced autosave functionality for App.
 */
import { useEffect, useRef } from 'react';
import { GameStateStack, DebugPacketStack } from '../types';
import {
  saveGameStateToLocalStorage,
  saveDebugPacketStackToLocalStorage,
  saveDebugLoreToLocalStorage,
} from '../services/storage';

export const AUTOSAVE_DEBOUNCE_TIME = 1500;

export interface UseAutosaveOptions {
  readonly gatherGameStateStack: () => GameStateStack;
  readonly gatherDebugPacketStack: () => DebugPacketStack;
  readonly isLoading: boolean;
  readonly hasGameBeenInitialized: boolean;
  readonly appReady: boolean;
  readonly dialogueState: unknown;
  readonly dependencies: Array<unknown>;
  readonly setError?: (msg: string | null) => void;
}

export function useAutosave({
  gatherGameStateStack,
  gatherDebugPacketStack,
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
      const debugStack = gatherDebugPacketStack();
      saveGameStateToLocalStorage(
        gameStateStack,
        setError ? (msg) => { setError(msg); } : undefined,
      );
      saveDebugPacketStackToLocalStorage(debugStack);
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
    gatherDebugPacketStack,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    dependenciesKey,
    setError,
  ]);
}
