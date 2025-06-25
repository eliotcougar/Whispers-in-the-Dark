/**
 * @file useDialogueSummary.ts
 * @description Hook for concluding a dialogue and summarizing its results.
 */

import { useState, useCallback, useEffect } from 'react';
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
import { MAX_LOG_MESSAGES, MAX_DIALOGUE_SUMMARIES_PER_NPC, PLAYER_HOLDER_ID } from '../constants';
import { addLogMessageToList } from '../utils/gameLogicUtils';
import { structuredCloneGameState } from '../utils/cloneUtils';

const DIALOGUE_EXIT_READ_DELAY_MS = 5000;

export interface UseDialogueSummaryProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (newGameState: FullGameState) => void;
  playerGenderProp: string;
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
  ) => void;
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
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded,
    getDialogueDebugLogs,
    clearDialogueDebugLogs,
  } = props;

  const [isDialogueExiting, setIsDialogueExiting] = useState<boolean>(false);
  const [dialogueUiCloseDelayTargetMs, setDialogueUiCloseDelayTargetMs] = useState<number>(0);
  const [dialogueNextSceneAttempted, setDialogueNextSceneAttempted] = useState<boolean>(false);

  /**
   * Finalizes a dialogue session and gathers summary updates.
   */
  const initiateDialogueExit = useCallback(async (stateAtDialogueConclusionStart: FullGameState) => {
    const currentThemeObj = stateAtDialogueConclusionStart.currentThemeObject;
    const finalHistory = stateAtDialogueConclusionStart.dialogueState?.history ?? [];
    const finalParticipants = stateAtDialogueConclusionStart.dialogueState?.participants ?? [];

    if (!currentThemeObj || !stateAtDialogueConclusionStart.dialogueState) {
      console.error('Cannot exit dialogue: current theme is null or not in dialogue state.', stateAtDialogueConclusionStart);
      onDialogueConcluded(
        null,
        stateAtDialogueConclusionStart,
        { turns: getDialogueDebugLogs() }
      );
      clearDialogueDebugLogs();
      setIsDialogueExiting(false);
      setIsLoading(false);
      setLoadingReason(null);
      return;
    }

    setIsLoading(true);
    setLoadingReason('dialogue_summary');
    setIsDialogueExiting(true);
    setDialogueNextSceneAttempted(false);
    setDialogueUiCloseDelayTargetMs(Date.now() + DIALOGUE_EXIT_READ_DELAY_MS);
    setError(null);

    const workingGameState = structuredCloneGameState(stateAtDialogueConclusionStart);

    setLoadingReason('dialogue_memory_creation');
    const memorySummaryContext: DialogueMemorySummaryContext = {
      themeName: currentThemeObj.name,
      currentThemeObject: currentThemeObj,
      currentScene: workingGameState.currentScene,
      localTime: workingGameState.localTime,
      localEnvironment: workingGameState.localEnvironment,
      localPlace: workingGameState.localPlace,
      dialogueParticipants: finalParticipants,
      dialogueLog: finalHistory,
    };
    const npcMemoryText = await executeMemorySummary(memorySummaryContext);

    const newSummaryRecord: DialogueSummaryRecord = {
      summaryText: npcMemoryText ?? 'A conversation took place, but the details are hazy.',
      participants: finalParticipants,
      timestamp: workingGameState.localTime ?? 'Unknown Time',
      location: workingGameState.localPlace ?? 'Unknown Location',
    };

    workingGameState.allNPCs = workingGameState.allNPCs.map((npc) => {
      if (finalParticipants.includes(npc.name) && npc.themeName === currentThemeObj.name) {
        const newSummaries = [...(npc.dialogueSummaries ?? []), newSummaryRecord];
        if (newSummaries.length > MAX_DIALOGUE_SUMMARIES_PER_NPC) {
          newSummaries.shift();
        }
        return { ...npc, dialogueSummaries: newSummaries };
      }
      return npc;
    });

    setLoadingReason('dialogue_conclusion_summary');
    const mapDataForSummary: MapData = {
      nodes: workingGameState.mapData.nodes.filter((node) => node.themeName === currentThemeObj.name),
      edges: workingGameState.mapData.edges.filter((edge) => {
        const sourceNode = workingGameState.mapData.nodes.find((n) => n.id === edge.sourceNodeId);
        const targetNode = workingGameState.mapData.nodes.find((n) => n.id === edge.targetNodeId);
        return sourceNode?.themeName === currentThemeObj.name && targetNode?.themeName === currentThemeObj.name;
      }),
    };
    const summaryContextForUpdates: DialogueSummaryContext = {
      mainQuest: workingGameState.mainQuest,
      currentObjective: workingGameState.currentObjective,
      currentScene: workingGameState.currentScene,
      localTime: workingGameState.localTime,
      localEnvironment: workingGameState.localEnvironment,
      localPlace: workingGameState.localPlace,
      mapDataForTheme: mapDataForSummary,
      knownNPCsInTheme: workingGameState.allNPCs.filter((npc) => npc.themeName === currentThemeObj.name),
      inventory: workingGameState.inventory.filter(item => item.holderId === PLAYER_HOLDER_ID),
      playerGender: playerGenderProp,
      dialogueLog: finalHistory,
      dialogueParticipants: finalParticipants,
      themeName: currentThemeObj.name,
      currentThemeObject: currentThemeObj,
    };
    const {
      parsed: summaryUpdatePayload,
      prompt: summaryPrompt,
      rawResponse: summaryRawResponse,
      thoughts: summaryThoughts,
    } = await executeDialogueSummary(summaryContextForUpdates);

    const participantsForLog = [...finalParticipants];
    const dialogueBlock =
      `Conversation transcript with ${participantsForLog.join(', ')}:\n` +
      finalHistory.map((entry) => `  ${entry.speaker}: ${entry.line}`).join('\n');
    workingGameState.gameLog = addLogMessageToList(workingGameState.gameLog, dialogueBlock, MAX_LOG_MESSAGES);

    workingGameState.dialogueState = null;

    const debugInfo = {
      turns: getDialogueDebugLogs(),
      summaryPrompt,
      summaryRawResponse,
      summaryThoughts,
    };
    onDialogueConcluded(summaryUpdatePayload, workingGameState, debugInfo);
    clearDialogueDebugLogs();
    setDialogueNextSceneAttempted(true);
  }, [playerGenderProp, setError, setIsLoading, setLoadingReason, onDialogueConcluded, getDialogueDebugLogs, clearDialogueDebugLogs]);

  useEffect(() => {
    if (isDialogueExiting && dialogueNextSceneAttempted && Date.now() >= dialogueUiCloseDelayTargetMs) {
      setIsDialogueExiting(false);
    }
  }, [isDialogueExiting, dialogueNextSceneAttempted, dialogueUiCloseDelayTargetMs]);

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

