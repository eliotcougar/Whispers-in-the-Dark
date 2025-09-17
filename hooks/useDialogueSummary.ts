/**
 * @file useDialogueSummary.ts
 * @description Hook for concluding a dialogue and summarizing its results.
 */

import { useState, useCallback } from 'react';
import {
  DialogueHistoryEntry,
  GameStateFromAI,
  FullGameState,
  DialogueSummaryContext,
  LoadingReason,
  MapData,
  DialogueSummaryRecord,
  DialogueMemorySummaryContext,
  DialogueTurnDebugEntry,
} from '../types';
import {
  executeDialogueSummary,
  executeMemorySummary,
} from '../services/dialogue';
import { MAX_DIALOGUE_SUMMARIES_PER_NPC, PLAYER_HOLDER_ID } from '../constants';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { isStoryArcValid } from '../utils/storyArcUtils';


export interface UseDialogueSummaryProps {
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
  getDialogueDebugLogs: () => Array<DialogueTurnDebugEntry>;
  clearDialogueDebugLogs: () => void;
}

/**
 * Provides helpers for wrapping up a dialogue and generating summaries.
 */
export const useDialogueSummary = (props: UseDialogueSummaryProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded,
    getDialogueDebugLogs,
    clearDialogueDebugLogs,
  } = props;

  const [isDialogueExiting, setIsDialogueExiting] = useState<boolean>(false);

  /**
   * Finalizes a dialogue session and gathers summary updates.
   */
  const initiateDialogueExit = useCallback(async (stateAtDialogueConclusionStart: FullGameState) => {
    const { dialogueState } = stateAtDialogueConclusionStart;
    if (!dialogueState) {
      console.error('Cannot exit dialogue: no dialogue state available.', stateAtDialogueConclusionStart);
      await onDialogueConcluded(
        null,
        stateAtDialogueConclusionStart,
        { turns: getDialogueDebugLogs() },
      );
      clearDialogueDebugLogs();
      setIsDialogueExiting(false);
      setIsLoading(false);
      setLoadingReason(null);
      return;
    }

    setIsLoading(true);
    setIsDialogueExiting(true);
    setError(null);

    const workingGameState = structuredCloneGameState(stateAtDialogueConclusionStart);
    const currentThemeObj = workingGameState.currentTheme;
    const finalHistory = dialogueState.history;
    const finalParticipants = dialogueState.participants;
    // Enter dialogue memory creation phase in the FSM.
    workingGameState.turnState = 'dialogue_memory';
    commitGameState(workingGameState);

    setLoadingReason('dialogue_memory');
    const memorySummaryContext: DialogueMemorySummaryContext = {
      themeName: workingGameState.currentTheme.name,
      currentTheme: workingGameState.currentTheme,
      currentScene: workingGameState.currentScene,
      localTime: workingGameState.localTime,
      localEnvironment: workingGameState.localEnvironment,
      localPlace: workingGameState.localPlace,
      dialogueParticipants: finalParticipants,
      dialogueLog: finalHistory,
      heroShortName: workingGameState.heroSheet.heroShortName || 'Player',
    };
    const npcMemoryText = await executeMemorySummary(memorySummaryContext);

    const newSummaryRecord: DialogueSummaryRecord = {
      summaryText: npcMemoryText ?? 'A conversation took place, but the details are hazy.',
      participants: finalParticipants,
      timestamp: workingGameState.localTime,
      location: workingGameState.localPlace,
    };

    workingGameState.allNPCs = workingGameState.allNPCs.map((npc) => {
      if (dialogueState.participants.includes(npc.name)) {
        const newSummaries = [...(npc.dialogueSummaries ?? []), newSummaryRecord];
        if (newSummaries.length > MAX_DIALOGUE_SUMMARIES_PER_NPC) {
          newSummaries.shift();
        }
        return { ...npc, dialogueSummaries: newSummaries };
      }
      return npc;
    });

    setLoadingReason('dialogue_summary');
    const mapDataForSummary: MapData = workingGameState.mapData;
    const act = isStoryArcValid(workingGameState.storyArc)
      ? workingGameState.storyArc.acts[
        workingGameState.storyArc.currentAct - 1
      ]
      : null;
    const summaryContextForUpdates: DialogueSummaryContext = {
      mainQuest: act?.mainObjective ?? null,
      currentObjective: workingGameState.currentObjective,
      currentScene: workingGameState.currentScene,
      localTime: workingGameState.localTime,
      localEnvironment: workingGameState.localEnvironment,
      localPlace: workingGameState.localPlace,
      mapDataForTheme: mapDataForSummary,
      knownNPCsInTheme: workingGameState.allNPCs,
      inventory: workingGameState.inventory.filter(item => item.holderId === PLAYER_HOLDER_ID),
      dialogueLog: finalHistory,
      dialogueParticipants: finalParticipants,
      heroSheet: workingGameState.heroSheet,
      themeName: currentThemeObj.name,
      currentTheme: currentThemeObj,
      storyArc: workingGameState.storyArc,
    };
    const {
      parsed: summaryUpdatePayload,
      prompt: summaryPrompt,
      rawResponse: summaryRawResponse,
      thoughts: summaryThoughts,
    } = await executeDialogueSummary(summaryContextForUpdates);

    // Dialogue transcript previously logged to the game history is now omitted
    // since the Loremaster maintains summaries of key exchanges.

    workingGameState.dialogueState = null;

    const debugInfo = {
      turns: getDialogueDebugLogs(),
      summaryPrompt,
      summaryRawResponse,
      summaryThoughts,
    };
    await onDialogueConcluded(
      summaryUpdatePayload,
      workingGameState,
      debugInfo,
    );
    clearDialogueDebugLogs();
    setIsDialogueExiting(false);
  }, [setError, setIsLoading, setLoadingReason, onDialogueConcluded, getDialogueDebugLogs, clearDialogueDebugLogs, commitGameState]);


  /**
   * Immediately aborts the dialogue and triggers the summary workflow.
   */
  const handleForceExitDialogue = useCallback(() => {
    const currentFullState = getCurrentGameState();
    if (currentFullState.dialogueState && !isDialogueExiting) {
      const forceExitEntry: DialogueHistoryEntry = { speaker: 'Player', line: '(Forces the conversation to end)' };
      const historyWithForceExit = [...currentFullState.dialogueState.history, forceExitEntry];

      const stateWithForceExit: FullGameState = {
        ...currentFullState,
        dialogueState: {
          ...currentFullState.dialogueState,
          history: historyWithForceExit,
          options: [],
        },
        lastTurnChanges: null,
      };
      commitGameState(stateWithForceExit);
      void initiateDialogueExit(stateWithForceExit);
    }
  }, [getCurrentGameState, commitGameState, isDialogueExiting, initiateDialogueExit]);

  return { isDialogueExiting, initiateDialogueExit, handleForceExitDialogue };
};

