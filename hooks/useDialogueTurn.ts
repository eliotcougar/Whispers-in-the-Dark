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
import { executeDialogueTurn } from '../services/dialogue';
import { collectRelevantFacts_Service } from '../services/loremaster';
import { PLAYER_HOLDER_ID, RECENT_LOG_COUNT_FOR_PROMPT } from '../constants';
import { formatDetailedContextForMentionedEntities } from '../utils/promptFormatters';
import { DialogueTurnDebugEntry } from '../types';

export interface UseDialogueTurnProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (newGameState: FullGameState) => void;
  playerGenderProp: string;
  setError: (error: string | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  initiateDialogueExit: (preparedState: FullGameState) => Promise<void>;
  isDialogueExiting: boolean;
  addDebugEntry: (entry: DialogueTurnDebugEntry) => void;
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
    addDebugEntry,
  } = props;

  const handleDialogueOptionSelect = useCallback(async (option: string) => {
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
        ...currentFullState.dialogueState,
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
          node => node.themeName === currentThemeObj.name && node.data.nodeType !== 'feature'
        );
        const currentThemeCharacters = stateAfterPlayerChoice.allCharacters.filter(c => c.themeName === currentThemeObj.name);
        const recentLogs = stateAfterPlayerChoice.gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT);
        const detailedContextForFacts = formatDetailedContextForMentionedEntities(
          currentThemeMapNodes,
          currentThemeCharacters,
          `${stateAfterPlayerChoice.currentScene} ${option}`,
          'Locations mentioned:',
          'Characters mentioned:'
        );
        const sortedFacts = [...stateAfterPlayerChoice.themeFacts]
          .sort((a, b) => (b.tier - a.tier) || (b.createdTurn - a.createdTurn))
          .map(f => ({ text: f.text, tier: f.tier }));
        setLoadingReason('loremaster');
        const collectResult = await collectRelevantFacts_Service({
          themeName: currentThemeObj.name,
          facts: sortedFacts,
          lastScene: stateAfterPlayerChoice.currentScene,
          playerAction: option,
          recentLogEntries: recentLogs,
          detailedContext: detailedContextForFacts,
        });
        setLoadingReason('dialogue_turn');
        const relevantFacts = collectResult?.facts ?? [];
        const { parsed: turnData, prompt: turnPrompt, rawResponse, thoughts } = await executeDialogueTurn(
          currentThemeObj,
          stateAfterPlayerChoice.mainQuest,
          stateAfterPlayerChoice.currentObjective,
          stateAfterPlayerChoice.currentScene,
          stateAfterPlayerChoice.localTime,
          stateAfterPlayerChoice.localEnvironment,
          stateAfterPlayerChoice.localPlace,
          currentThemeMapNodes,
          stateAfterPlayerChoice.allCharacters.filter((c) => c.themeName === currentThemeObj.name),
          stateAfterPlayerChoice.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
          playerGenderProp,
          historyWithPlayerChoice,
          option,
          (() => {
            if (!stateAfterPlayerChoice.dialogueState) {
              throw new Error('Dialogue state is not defined');
            }
            return stateAfterPlayerChoice.dialogueState.participants;
          })(),
          relevantFacts,
        );
        addDebugEntry({ prompt: turnPrompt, rawResponse, thoughts });

        const latestStateAfterFetch = getCurrentGameState();
        if (turnData && latestStateAfterFetch.dialogueState) {
          const newHistoryWithNpcResponses = [...historyWithPlayerChoice, ...turnData.npcResponses];

          const nextDialogueStateData: DialogueData = {
            participants: turnData.updatedParticipants ?? latestStateAfterFetch.dialogueState.participants,
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

          if (turnData.dialogueEnds) {
            await initiateDialogueExit(stateWithNpcResponse);
          }
        } else if (latestStateAfterFetch.dialogueState) {
          setError('The conversation faltered. Try choosing an option again or ending the dialogue.');
          const errorDialogueState = { ...latestStateAfterFetch.dialogueState };
          if (errorDialogueState.options.length === 0) {
            errorDialogueState.options = originalOptions.length > 0 ? originalOptions : ['End Conversation.'];
          }
          commitGameState({ ...latestStateAfterFetch, dialogueState: errorDialogueState, lastTurnChanges: null });
        }
      } catch (e: unknown) {
        console.error('Error during dialogue turn:', e);
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
        const { dialogueState } = latestState;
        if (!(dialogueState && dialogueState.options.length === 0 && dialogueState.history.length > 0)) {
          setIsLoading(false);
          setLoadingReason(null);
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
    addDebugEntry,
  ]);

  return { handleDialogueOptionSelect };
};

