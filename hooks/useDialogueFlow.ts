
/**
 * @file useDialogueFlow.ts
 * @description This hook manages the flow of dialogue interactions within the game.
 * It handles player dialogue choices, fetching NPC responses from the AI,
 * and the process of concluding a dialogue, including summarizing its outcomes.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  DialogueHistoryEntry,
  DialogueSummaryResponse,
  FullGameState,
  AdventureTheme,
  DialogueSummaryContext,
  DialogueData,
  Item,
  Character,
  LoadingReason,
  MapNode, 
  MapData, 
  DialogueSummaryRecord,
  DialogueMemorySummaryContext // Added
} from '../types';
import {
  fetchDialogueTurn,
  summarizeDialogueForUpdates,
  summarizeDialogueForMemory // Added
} from '../services/dialogueService';
import { MAX_LOG_MESSAGES, MAX_DIALOGUE_SUMMARIES_PER_CHARACTER } from '../constants';
import { addLogMessageToList } from '../utils/gameLogicUtils';

const DIALOGUE_EXIT_READ_DELAY_MS = 5000;

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

  const [isDialogueExiting, setIsDialogueExiting] = useState<boolean>(false);
  const [dialogueUiCloseDelayTargetMs, setDialogueUiCloseDelayTargetMs] = useState<number>(0);
  const [dialogueNextSceneAttempted, setDialogueNextSceneAttempted] = useState<boolean>(false);

  /**
   * Internal function to handle the common logic for exiting dialogue mode.
   * @param {FullGameState} baseStateWithPlayerChoice - The game state that already includes the player's final dialogue line or force-exit action in its history, and should have options cleared.
   */
  const initiateDialogueExit = useCallback(async (stateAtDialogueConclusionStart: FullGameState) => {
    const currentThemeObj = stateAtDialogueConclusionStart.currentThemeObject; // Use directly from state
    const finalHistory = stateAtDialogueConclusionStart.dialogueState?.history || [];
    const finalParticipants = stateAtDialogueConclusionStart.dialogueState?.participants || [];

    if (!currentThemeObj || !stateAtDialogueConclusionStart.dialogueState) {
      console.error("Cannot exit dialogue: current theme is null or not in dialogue state.", stateAtDialogueConclusionStart);
      onDialogueConcluded(null, stateAtDialogueConclusionStart); 
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

    let workingGameState = JSON.parse(JSON.stringify(stateAtDialogueConclusionStart)) as FullGameState;

    setLoadingReason('dialogue_memory_creation');
    const memorySummaryContext: DialogueMemorySummaryContext = {
        themeName: currentThemeObj.name, // Still useful for identification if theme object is complex
        currentThemeObject: currentThemeObj,
        currentScene: workingGameState.currentScene,
        localTime: workingGameState.localTime,
        localEnvironment: workingGameState.localEnvironment,
        localPlace: workingGameState.localPlace,
        dialogueParticipants: finalParticipants,
        dialogueLog: finalHistory,
    };
    const characterMemoryText = await summarizeDialogueForMemory(memorySummaryContext);

    const newSummaryRecord: DialogueSummaryRecord = {
      summaryText: characterMemoryText || "A conversation took place, but the details are hazy.",
      participants: finalParticipants,
      timestamp: workingGameState.localTime || "Unknown Time",
      location: workingGameState.localPlace || "Unknown Location",
    };
    

    workingGameState.allCharacters = workingGameState.allCharacters.map(char => {
      if (finalParticipants.includes(char.name) && char.themeName === currentThemeObj.name) {
        const newSummaries = [...(char.dialogueSummaries || []), newSummaryRecord];
        if (newSummaries.length > MAX_DIALOGUE_SUMMARIES_PER_CHARACTER) {
          newSummaries.shift();
        }
        return { ...char, dialogueSummaries: newSummaries };
      }
      return char;
    });
    

    setLoadingReason('dialogue_conclusion_summary');
     const mapDataForSummary: MapData = {
        nodes: workingGameState.mapData.nodes.filter(node => node.themeName === currentThemeObj.name),
        edges: workingGameState.mapData.edges.filter(edge => {
            const sourceNode = workingGameState.mapData.nodes.find(n => n.id === edge.sourceNodeId);
            const targetNode = workingGameState.mapData.nodes.find(n => n.id === edge.targetNodeId);
            return sourceNode?.themeName === currentThemeObj.name && targetNode?.themeName === currentThemeObj.name;
        })
    };
    const summaryContextForUpdates: DialogueSummaryContext = {
      mainQuest: workingGameState.mainQuest,
      currentObjective: workingGameState.currentObjective,
      currentScene: workingGameState.currentScene,
      localTime: workingGameState.localTime,
      localEnvironment: workingGameState.localEnvironment,
      localPlace: workingGameState.localPlace,
      mapDataForTheme: mapDataForSummary, 
      knownCharactersInTheme: workingGameState.allCharacters.filter(c => c.themeName === currentThemeObj.name),
      inventory: workingGameState.inventory,
      playerGender: playerGenderProp,
      dialogueLog: finalHistory, 
      dialogueParticipants: finalParticipants, 
      themeName: currentThemeObj.name, // Still useful for identification
      currentThemeObject: currentThemeObj,
    };
    const summaryUpdatePayload = await summarizeDialogueForUpdates(summaryContextForUpdates);
    
    const participantsForLog = [...(finalParticipants || [])];
    const dialogueBlock = `Conversation transcript with ${participantsForLog.join(', ')}:\n` + finalHistory.map(entry => `  ${entry.speaker}: ${entry.line}`).join('\n');
    workingGameState.gameLog = addLogMessageToList(workingGameState.gameLog, dialogueBlock, MAX_LOG_MESSAGES);
    
    workingGameState.dialogueState = null;

    onDialogueConcluded(summaryUpdatePayload, workingGameState); 
    setDialogueNextSceneAttempted(true);

  }, [
    playerGenderProp, setError, setIsLoading, setLoadingReason, 
    onDialogueConcluded
  ]);

  useEffect(() => {
    if (isDialogueExiting && dialogueNextSceneAttempted && Date.now() >= dialogueUiCloseDelayTargetMs) {
      setIsDialogueExiting(false);
    }
  }, [isDialogueExiting, dialogueNextSceneAttempted, dialogueUiCloseDelayTargetMs]);

  const handleDialogueOptionSelect = useCallback(async (option: string) => {
    const currentFullState = getCurrentGameState();
    const currentThemeObj = currentFullState.currentThemeObject; // Use directly from state

    if (!currentThemeObj || !currentFullState.dialogueState || isDialogueExiting) return;

    const playerEntry: DialogueHistoryEntry = { speaker: "Player", line: option };
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
        
        const currentThemeMapNodes = stateAfterPlayerChoice.mapData.nodes.filter(node => node.themeName === currentThemeObj.name && !node.data.isLeaf);
        const turnData = await fetchDialogueTurn(
          currentThemeObj, 
          stateAfterPlayerChoice.mainQuest,
          stateAfterPlayerChoice.currentObjective,
          stateAfterPlayerChoice.currentScene,
          stateAfterPlayerChoice.localTime,
          stateAfterPlayerChoice.localEnvironment,
          stateAfterPlayerChoice.localPlace,
          currentThemeMapNodes, 
          stateAfterPlayerChoice.allCharacters.filter(c => c.themeName === currentThemeObj.name), 
          stateAfterPlayerChoice.inventory,
          playerGenderProp,
          historyWithPlayerChoice, 
          option, 
          stateAfterPlayerChoice.dialogueState.participants 
        );

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
          
          const stateWithNpcResponse: FullGameState = { ...latestStateAfterFetch, dialogueState: nextDialogueStateData, lastTurnChanges: null };
          commitGameState(stateWithNpcResponse);

          if (turnData.dialogueEnds) {
            await initiateDialogueExit(stateWithNpcResponse);
          }
        } else if (latestStateAfterFetch.dialogueState) { 
          setError("The conversation faltered. Try choosing an option again or ending the dialogue.");
          let errorDialogueState = { ...latestStateAfterFetch.dialogueState }; 
          if (errorDialogueState.options.length === 0) { 
              errorDialogueState.options = originalOptions.length > 0 ? originalOptions : ["End Conversation."]; 
          }
          commitGameState({...latestStateAfterFetch, dialogueState: errorDialogueState, lastTurnChanges: null});
        }
      } catch (e) {
        console.error("Error during dialogue turn:", e);
        setError("An error occurred in the conversation. You might need to end it.");
        const stateToRevertToOnError = getCurrentGameState(); 
        if (stateToRevertToOnError.dialogueState) {
            const restoredOptions = originalOptions.length > 0 ? originalOptions : ["Try to end the conversation."];
            commitGameState({...stateToRevertToOnError, dialogueState: {...stateToRevertToOnError.dialogueState, options: restoredOptions }, lastTurnChanges: null});
        }
      } finally {
        const latestState = getCurrentGameState();
        const stillInActiveNonExitingDialogue = latestState.dialogueState !== null && 
                                              !isDialogueExiting && 
                                              !(latestState.dialogueState.options.length === 0 && latestState.dialogueState.history.length > 0); 
        
        if(stillInActiveNonExitingDialogue) { 
            setIsLoading(false);
            setLoadingReason(null);
        }
      }
    }
  }, [
    getCurrentGameState, commitGameState, playerGenderProp, isDialogueExiting,
    setError, setIsLoading, setLoadingReason, initiateDialogueExit
  ]);

  const handleForceExitDialogue = useCallback(() => {
    const currentFullState = getCurrentGameState();
    if (currentFullState.dialogueState && !isDialogueExiting) {
      const forceExitEntry: DialogueHistoryEntry = {speaker: "Player", line: "(Forces the conversation to end)"};
      const historyWithForceExit = [...currentFullState.dialogueState.history, forceExitEntry];
      
      const stateWithForceExit: FullGameState = {
        ...currentFullState,
        dialogueState: {
          ...currentFullState.dialogueState,
          history: historyWithForceExit,
          options: [] 
        },
        lastTurnChanges: null,
      };
      commitGameState(stateWithForceExit); 
      initiateDialogueExit(stateWithForceExit); 
    }
  }, [getCurrentGameState, commitGameState, isDialogueExiting, initiateDialogueExit]);

  return {
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,
  };
};
