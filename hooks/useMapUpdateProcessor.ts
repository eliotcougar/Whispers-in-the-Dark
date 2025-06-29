/**
 * @file useMapUpdateProcessor.ts
 * @description Hook that processes map updates from AI responses.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  GameStateFromAI,
  AdventureTheme,
  FullGameState,
  LoadingReason,
  TurnChanges,
} from '../types';
import { handleMapUpdates } from '../utils/mapUpdateHandlers';

export interface UseMapUpdateProcessorProps {
  loadingReason: LoadingReason | null;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
}

/**
 * Provides a helper for applying map updates while managing error state.
 */
export const useMapUpdateProcessor = ({
  loadingReason,
  setLoadingReason,
  setError,
}: UseMapUpdateProcessorProps) => {
  const loadingReasonRef = useRef<LoadingReason | null>(loadingReason);

  useEffect(() => {
    loadingReasonRef.current = loadingReason;
  }, [loadingReason]);

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
          setLoadingReason,
          turnChanges,
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [setLoadingReason, setError],
  );

  return { processMapUpdates };
};
