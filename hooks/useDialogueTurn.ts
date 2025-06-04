/**
 * @file useDialogueTurn.ts
 * @description Hook for executing individual dialogue turns with the AI.
 */

import { useCallback } from 'react';
import {
  DialogueHistoryEntry,
  FullGameState,
  DialogueData,
  LoadingReason,
} from '../types';
import { fetchDialogueTurn } from '../services/dialogueService';

export interface UseDialogueTurnProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (newGameState: FullGameState) => void;
  playerGenderProp: string;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  initiateDialogueExit: (preparedState: FullGameState) => Promise<void>;
  isDialogueExiting: boolean;
}

/**
 * Handles player option selection and subsequent AI responses.
 */
export const useDialogueTurn = (props: UseDialogueTurnProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    initiateDialogueExit,
    isDialogueExiting,
  } = props;

  const handleDialogueOptionSelect = useCallback(async (option: string) => {
    console.log('[DEBUG FLOW] Dialogue option selected:', option);
    const currentFullState = getCurrentGameState();
    const currentThemeObj = currentFullState.currentThemeObject;

    if (!currentThemeObj || !currentFullState.dialogueState || isDialogueExiting) return;

    const playerEntry: DialogueHistoryEntry = { speaker: 'Player', line: option };
    const originalOptions = [...currentFullState.dialogueState.options];
    const historyWithPlayerChoice = [...currentFullState.dialogueState.history, playerEntry];

    const isExitOption = originalOptions.length > 0 && option === originalOptions[originalOptions.length - 1];

    const stateAfterPlayerChoice: FullGameState = {
      ...currentFullState,
      dialogueState: {
        ...(currentFullState.dialogueState as DialogueData),
        history: historyWithPlayerChoice,
        options: [],
      },
      lastTurnChanges: null,
    };
    commitGameState(stateAfterPlayerChoice);

    if (isExitOption) {
      await initiateDialogueExit(stateAfterPlayerChoice);
    } else {
      setIsLoading(true);
      setLoadingReason('dialogue_turn');
      setError(null);

      try {
        const currentThemeMapNodes = stateAfterPlayerChoice.mapData.nodes.filter(
          (node) => node.themeName === currentThemeObj.name && !node.data.isLeaf
        );
        const turnData = await fetchDialogueTurn(
          currentThemeObj,
          stateAfterPlayerChoice.mainQuest,
          stateAfterPlayerChoice.currentObjective,
          stateAfterPlayerChoice.currentScene,
          stateAfterPlayerChoice.localTime,
          stateAfterPlayerChoice.localEnvironment,
          stateAfterPlayerChoice.localPlace,
          currentThemeMapNodes,
          stateAfterPlayerChoice.allCharacters.filter((c) => c.themeName === currentThemeObj.name),
          stateAfterPlayerChoice.inventory,
          playerGenderProp,
          historyWithPlayerChoice,
          option,
          stateAfterPlayerChoice.dialogueState!.participants
        );
        console.log('[DEBUG FLOW] Dialogue turn data received:', turnData);

        const latestStateAfterFetch = getCurrentGameState();
        if (turnData && latestStateAfterFetch.dialogueState) {
          const newHistoryWithNpcResponses = [...historyWithPlayerChoice, ...turnData.npcResponses];

          const nextDialogueStateData: DialogueData = {
            participants: turnData.updatedParticipants || latestStateAfterFetch.dialogueState.participants,
            history: newHistoryWithNpcResponses,
            options: turnData.playerOptions,
          };

          if (turnData.dialogueEnds) {
            nextDialogueStateData.options = [];
          }

          const stateWithNpcResponse: FullGameState = {
            ...latestStateAfterFetch,
            dialogueState: nextDialogueStateData,
            lastTurnChanges: null,
          };
          commitGameState(stateWithNpcResponse);
          console.log('[DEBUG FLOW] NPC responses processed and state committed.');

          if (turnData.dialogueEnds) {
            await initiateDialogueExit(stateWithNpcResponse);
          }
        } else if (latestStateAfterFetch.dialogueState) {
          setError('The conversation faltered. Try choosing an option again or ending the dialogue.');
          let errorDialogueState = { ...latestStateAfterFetch.dialogueState };
          if (errorDialogueState.options.length === 0) {
            errorDialogueState.options = originalOptions.length > 0 ? originalOptions : ['End Conversation.'];
          }
          commitGameState({ ...latestStateAfterFetch, dialogueState: errorDialogueState, lastTurnChanges: null });
        }
      } catch (e) {
        console.error('Error during dialogue turn:', e);
        console.log('[DEBUG FLOW] Error occurred while fetching dialogue turn');
        setError('An error occurred in the conversation. You might need to end it.');
        const stateToRevertToOnError = getCurrentGameState();
        if (stateToRevertToOnError.dialogueState) {
          const restoredOptions = originalOptions.length > 0 ? originalOptions : ['Try to end the conversation.'];
          commitGameState({
            ...stateToRevertToOnError,
            dialogueState: { ...stateToRevertToOnError.dialogueState, options: restoredOptions },
            lastTurnChanges: null,
          });
        }
      } finally {
        const latestState = getCurrentGameState();
        const stillInActiveNonExitingDialogue =
          latestState.dialogueState !== null &&
          !isDialogueExiting &&
          !(latestState.dialogueState.options.length === 0 && latestState.dialogueState.history.length > 0);

        if (stillInActiveNonExitingDialogue) {
          setIsLoading(false);
          setLoadingReason(null);
          console.log('[DEBUG FLOW] Dialogue turn complete, awaiting player choice');
        }
      }
    }
  }, [
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    isDialogueExiting,
    setError,
    setIsLoading,
    setLoadingReason,
    initiateDialogueExit,
  ]);

  return { handleDialogueOptionSelect };
};

