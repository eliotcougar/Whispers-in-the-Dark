/**
 * @file useMapUpdateProcessor.ts
 * @description Hook that processes map updates from AI responses.
 */
import { useCallback } from 'react';
import * as React from 'react';
import {
  GameStateFromAI,
  AdventureTheme,
  FullGameState,
  LoadingReason,
  TurnChanges,
} from '../types';
import { handleMapUpdates } from '../utils/mapUpdateHandlers';

export interface UseMapUpdateProcessorProps {
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setError: (err: string | null) => void;
}

/**
 * Provides a helper for applying map updates while managing error state.
 */
export const useMapUpdateProcessor = ({
  loadingReasonRef,
  setError,
}: UseMapUpdateProcessorProps) => {

  const processMapUpdates = useCallback(
    async (
      aiData: GameStateFromAI,
      draftState: FullGameState,
      baseStateSnapshot: FullGameState,
      themeContext: AdventureTheme,
      turnChanges: TurnChanges,
    ) => {
      try {
        await handleMapUpdates(
          aiData,
          draftState,
          baseStateSnapshot,
          themeContext,
          loadingReasonRef.current,
          turnChanges,
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [loadingReasonRef, setError],
  );

  return { processMapUpdates };
};
