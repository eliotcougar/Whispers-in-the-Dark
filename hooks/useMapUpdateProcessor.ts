/**
 * @file useMapUpdateProcessor.ts
 * @description Hook that processes map updates from AI responses.
 */
import { useCallback } from 'react';
import * as React from 'react';
import {
  GameStateFromAI,
  FullGameState,
  LoadingReason,
  TurnChanges,
} from '../types';
import { handleMapUpdates } from '../utils/mapUpdateHandlers';

export interface UseMapUpdateProcessorProps {
  loadingReasonRef: React.RefObject<LoadingReason | null>;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
}

/**
 * Provides a helper for applying map updates while managing error state.
 */
export const useMapUpdateProcessor = ({
  loadingReasonRef,
  setLoadingReason,
  setError,
}: UseMapUpdateProcessorProps) => {

  const processMapUpdates = useCallback(
    async (
      aiData: GameStateFromAI,
      draftState: FullGameState,
      baseStateSnapshot: FullGameState,
      turnChanges: TurnChanges,
    ) => {
      try {
        await handleMapUpdates(
          aiData,
          draftState,
          baseStateSnapshot,
          loadingReasonRef.current,
          setLoadingReason,
          turnChanges,
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [loadingReasonRef, setLoadingReason, setError],
  );

  return { processMapUpdates };
};
