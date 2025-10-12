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
  ValidNPCUpdatePayload,
} from '../types';
import { executeDialogueTurn } from '../services/dialogue';
import { collectRelevantFacts } from '../services/loremaster';
import { isInvalidApiKeyError, INVALID_API_KEY_USER_MESSAGE } from '../utils/aiErrorUtils';
import { PLAYER_HOLDER_ID, RECENT_LOG_COUNT_FOR_PROMPT } from '../constants';
import { formatDetailedContextForMentionedEntities } from '../utils/promptFormatters';
import { DialogueTurnDebugEntry } from '../types';
import { applyAllNPCChanges } from '../utils/npcUtils';

export interface UseDialogueTurnProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (newGameState: FullGameState) => void;
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
    setError,
    setIsLoading,
    setLoadingReason,
    initiateDialogueExit,
    isDialogueExiting,
    addDebugEntry,
  } = props;

  const handleDialogueOptionSelect = useCallback(async (option: string) => {
    const currentFullState = getCurrentGameState();
    if (!currentFullState.dialogueState || isDialogueExiting) return;
    const theme = currentFullState.theme;

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

    const dialogueStateAfterChoice = stateAfterPlayerChoice.dialogueState;
    if (!dialogueStateAfterChoice) {
      setError('The conversation ended unexpectedly. Try selecting an option again.');
      setIsLoading(false);
      setLoadingReason(null);
      return;
    }

    if (isExitOption) {
      await initiateDialogueExit(stateAfterPlayerChoice);
    } else {
      setIsLoading(true);
      setLoadingReason('dialogue_turn');
      setError(null);

      try {
        const mapNodes = stateAfterPlayerChoice.mapData.nodes.filter(
          node => node.type !== 'feature'
        );
        const npcs = stateAfterPlayerChoice.allNPCs;
        const recentLogs = stateAfterPlayerChoice.gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT);
        const detailedContextForFacts = formatDetailedContextForMentionedEntities(
          mapNodes,
          npcs,
          `${stateAfterPlayerChoice.currentScene} ${option}`,
          'Locations mentioned:',
          'NPCs mentioned:'
        );
        const sortedFacts = [...stateAfterPlayerChoice.loreFacts]
          .sort((a, b) => (b.tier - a.tier) || (b.createdTurn - a.createdTurn))
          .map(f => ({ text: f.text, tier: f.tier }));
        setLoadingReason('loremaster_collect');
        const collectResult = await collectRelevantFacts({
          themeName: theme.name,
          facts: sortedFacts,
          lastScene: stateAfterPlayerChoice.currentScene,
          playerAction: option,
          recentLogEntries: recentLogs,
          detailedContext: detailedContextForFacts,
        });
        setLoadingReason('dialogue_turn');
        const relevantFacts = collectResult?.facts ?? [];
        const { parsed: turnData, prompt: turnPrompt, rawResponse, thoughts } = await executeDialogueTurn(
          theme,
          stateAfterPlayerChoice.storyArc,
          stateAfterPlayerChoice.mainQuest,
          stateAfterPlayerChoice.currentObjective,
          stateAfterPlayerChoice.currentScene,
          stateAfterPlayerChoice.localTime,
          stateAfterPlayerChoice.localEnvironment,
          stateAfterPlayerChoice.localPlace,
          mapNodes,
          npcs,
          stateAfterPlayerChoice.inventory.filter(item => item.holderId === PLAYER_HOLDER_ID),
          stateAfterPlayerChoice.heroSheet,
          historyWithPlayerChoice,
          option,
          dialogueStateAfterChoice.participants,
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

          let updatedAllNPCs = latestStateAfterFetch.allNPCs;
          const unionParticipantSet = new Set<string>([
            ...latestStateAfterFetch.dialogueState.participants,
            ...(turnData.updatedParticipants ?? latestStateAfterFetch.dialogueState.participants),
          ]);
          const knownNpcNames = new Set(latestStateAfterFetch.allNPCs.map(npc => npc.name));
          const filteredAttitudeUpdates = (turnData.npcAttitudeUpdates ?? []).filter(update =>
            unionParticipantSet.has(update.name) && knownNpcNames.has(update.name),
          );
          const filteredKnownNameUpdates = (turnData.npcKnownNameUpdates ?? []).filter(update =>
            unionParticipantSet.has(update.name) && knownNpcNames.has(update.name),
          );
          if (filteredAttitudeUpdates.length > 0) {
            const attitudePayloads: Array<ValidNPCUpdatePayload> = filteredAttitudeUpdates.map(
              ({ name, newAttitudeTowardPlayer }) => ({
                name,
                newAttitudeTowardPlayer,
              }),
            );
            updatedAllNPCs = applyAllNPCChanges([], attitudePayloads, latestStateAfterFetch.allNPCs);
          }
          if (filteredKnownNameUpdates.length > 0) {
            const namePayloads: Array<ValidNPCUpdatePayload> = [];
            filteredKnownNameUpdates.forEach(update => {
              const target = updatedAllNPCs.find(npc => npc.name === update.name);
              if (!target) return;
              if (update.newKnownPlayerNames !== undefined) {
                namePayloads.push({ name: update.name, newKnownPlayerNames: update.newKnownPlayerNames });
              } else if (update.addKnownPlayerName) {
                const existingNames = target.knowsPlayerAs;
                const trimmedAdd = update.addKnownPlayerName.trim();
                if (trimmedAdd.length === 0) return;
                const namesSet = new Set(existingNames);
                namesSet.add(trimmedAdd);
                namePayloads.push({ name: update.name, newKnownPlayerNames: Array.from(namesSet) });
              }
            });
            if (namePayloads.length > 0) {
              updatedAllNPCs = applyAllNPCChanges([], namePayloads, updatedAllNPCs);
            }
          }

          const stateWithNpcResponse: FullGameState = {
            ...latestStateAfterFetch,
            dialogueState: nextDialogueStateData,
            allNPCs: updatedAllNPCs,
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
        if (isInvalidApiKeyError(e)) {
          setError(INVALID_API_KEY_USER_MESSAGE);
        } else {
          setError('An error occurred in the conversation. You might need to end it.');
        }
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
        const exitInProgress =
          dialogueState != null &&
          dialogueState.options.length === 0 &&
          dialogueState.history.length > 0;
        const keepSpinner = exitInProgress || isDialogueExiting;
        if (keepSpinner) {
          // keep spinner until exit completes
        } else {
          setIsLoading(false);
          setLoadingReason(null);
        }
      }
    }
  }, [
    getCurrentGameState,
    commitGameState,
    isDialogueExiting,
    setError,
    setIsLoading,
    setLoadingReason,
    initiateDialogueExit,
    addDebugEntry,
  ]);

  return { handleDialogueOptionSelect };
};

