/**
 * @file useAutosave.ts
 * @description Provides debounced autosave functionality for App.
 */
import { useEffect, useRef } from 'react';

const useDependenciesVersion = (deps: Array<unknown>): number => {
  const lastDepsRef = useRef<Array<unknown>>([]);
  const versionRef = useRef(0);
  if (deps.length !== lastDepsRef.current.length ||
    deps.some((dep, index) => !Object.is(dep, lastDepsRef.current[index]))
  ) {
    lastDepsRef.current = deps;
    versionRef.current += 1;
  }
  return versionRef.current;
};

import { GameStateStack, DebugPacketStack } from '../types';
import {
  saveGameStateToLocalStorage,
  saveDebugPacketStackToLocalStorage,
  saveDebugLoreToLocalStorage,
} from '../services/storage';

export const AUTOSAVE_DEBOUNCE_TIME = 1500;

export interface UseAutosaveOptions {
  readonly appReady: boolean;
  readonly dependencies: Array<unknown>;
  readonly dialogueState: unknown;
  readonly gatherDebugPacketStack: () => DebugPacketStack;
  readonly gatherGameStateStack: () => GameStateStack;
  readonly hasGameBeenInitialized: boolean;
  readonly isLoading: boolean;
  readonly isTurnProcessing: boolean;
  readonly setError?: (msg: string | null) => void;
}

export function useAutosave({
  appReady,
  dependencies,
  dialogueState,
  gatherDebugPacketStack,
  gatherGameStateStack,
  hasGameBeenInitialized,
  isLoading,
  isTurnProcessing,
  setError,
}: UseAutosaveOptions) {
  const autosaveTimeoutRef = useRef<number | null>(null);

  const dependenciesVersion = useDependenciesVersion(dependencies);

  useEffect(() => {
    if (isLoading || isTurnProcessing || !hasGameBeenInitialized || !appReady || !!dialogueState) {
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
        setError,
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
    dependenciesVersion,
    isTurnProcessing,
    setError,
  ]);
}
