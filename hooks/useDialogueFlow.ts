/**
 * @file useDialogueFlow.ts
 * @description Orchestrates dialogue turns and summarization hooks.
 */

import { useRef } from 'react';
import {
  GameStateFromAI,
  FullGameState,
  LoadingReason,
  DialogueTurnDebugEntry,
} from '../types';
import { useDialogueTurn } from './useDialogueTurn';
import { useDialogueSummary } from './useDialogueSummary';

export interface UseDialogueFlowProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (newGameState: FullGameState) => void;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  onDialogueConcluded: (
    summaryPayload: GameStateFromAI | null,
    preparedGameState: FullGameState,
    debugInfo: {
      turns: Array<DialogueTurnDebugEntry>;
      summaryPrompt?: string;
      summaryRawResponse?: string;
      summaryThoughts?: Array<string>;
    }
  ) => Promise<void>;
}

/**
 * Combines dialogue turn handling with summary generation.
 */
export const useDialogueFlow = (props: UseDialogueFlowProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded,
  } = props;

  const dialogueLogsRef = useRef<Array<DialogueTurnDebugEntry>>([]);

  const addDebugEntry = (entry: DialogueTurnDebugEntry) => {
    dialogueLogsRef.current.push(entry);
  };

  const getDialogueDebugLogs = () => dialogueLogsRef.current;
  const clearDialogueDebugLogs = () => {
    dialogueLogsRef.current = [];
  };

  const {
    isDialogueExiting,
    initiateDialogueExit,
    handleForceExitDialogue,
  } = useDialogueSummary({
    getCurrentGameState,
    commitGameState,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded,
    getDialogueDebugLogs,
    clearDialogueDebugLogs,
  });

  const { handleDialogueOptionSelect } = useDialogueTurn({
    getCurrentGameState,
    commitGameState,
    setError,
    setIsLoading,
    setLoadingReason,
    initiateDialogueExit,
    isDialogueExiting,
    addDebugEntry,
  });

  return {
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,
  };
};

