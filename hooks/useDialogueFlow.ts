/**
 * @file useDialogueFlow.ts
 * @description Orchestrates dialogue turns and summarization hooks.
 */

import {
  DialogueSummaryResponse,
  FullGameState,
  LoadingReason,
} from '../types';
import { useDialogueTurn } from './useDialogueTurn';
import { useDialogueSummary } from './useDialogueSummary';

interface UseDialogueFlowProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (newGameState: FullGameState) => void;
  playerGenderProp: string;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  onDialogueConcluded: (
    summaryPayload: DialogueSummaryResponse | null,
    preparedGameState: FullGameState
  ) => void;
}

/**
 * Combines dialogue turn handling with summary generation.
 */
export const useDialogueFlow = (props: UseDialogueFlowProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded,
  } = props;

  const {
    isDialogueExiting,
    initiateDialogueExit,
    handleForceExitDialogue,
  } = useDialogueSummary({
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded,
  });

  const { handleDialogueOptionSelect } = useDialogueTurn({
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    initiateDialogueExit,
    isDialogueExiting,
  });

  return {
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,
  };
};

