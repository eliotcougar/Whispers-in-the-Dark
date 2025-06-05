/**
 * @file usePlayerActions.ts
 * @description Hook that handles player actions and AI response processing.
 */

import { useCallback, useRef } from 'react';
import {
  GameStateFromAI,
  DialogueSummaryResponse,
  Item,
  KnownUse,
  AdventureTheme,
  FullGameState,
  GameStateStack,
  ItemChange,
  ItemChangeRecord,
  LoadingReason,
  TurnChanges,
} from '../types';
import { executeAIMainTurn } from '../services/gameAIService';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';
import { fetchCorrectedName_Service } from '../services/corrections';
import { parseAIResponse } from '../services/aiResponseParser';
import {
  FREE_FORM_ACTION_COST,
  MAX_LOG_MESSAGES,
  RECENT_LOG_COUNT_FOR_PROMPT,
} from '../constants';
import {
  addLogMessageToList,
  buildItemChangeRecords,
  applyAllItemChanges,
} from '../utils/gameLogicUtils';
import { formatMainGameTurnPrompt } from '../utils/promptFormatters/dialogue';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { handleMapUpdates } from '../utils/mapUpdateHandlers';

export interface ProcessAiResponseOptions {
  forceEmptyInventory?: boolean;
  baseStateSnapshot: FullGameState;
  isFromDialogueSummary?: boolean;
  scoreChangeFromAction?: number;
}

export type ProcessAiResponseFn = (
  aiData: GameStateFromAI | DialogueSummaryResponse | null,
  themeContextForResponse: AdventureTheme | null,
  draftState: FullGameState,
  options: ProcessAiResponseOptions
) => Promise<void>;

export interface UsePlayerActionsProps {
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  setGameStateStack: React.Dispatch<React.SetStateAction<GameStateStack>>;
  playerGenderProp: string;
  stabilityLevelProp: number;
  chaosLevelProp: number;
  setIsLoading: (val: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
  setParseErrorCounter: (val: number) => void;
  triggerRealityShift: (isChaosShift?: boolean) => void;
  executeManualRealityShift: () => void;
  freeFormActionText: string;
  setFreeFormActionText: (text: string) => void;
  isLoading: boolean;
  hasGameBeenInitialized: boolean;
  loadingReason: LoadingReason | null;
}

/**
 * Provides helpers for executing player actions and processing AI responses.
 */
export const usePlayerActions = (props: UsePlayerActionsProps) => {
  const {
    getCurrentGameState,
    commitGameState,
    setGameStateStack,
    playerGenderProp,
    stabilityLevelProp,
    chaosLevelProp,
    setIsLoading,
    setLoadingReason,
    setError,
    setParseErrorCounter,
    triggerRealityShift,
    executeManualRealityShift,
    freeFormActionText,
    setFreeFormActionText,
    isLoading,
    hasGameBeenInitialized,
    loadingReason,
  } = props;

  const objectiveAnimationClearTimerRef = useRef<number | null>(null);

  const processAiResponse: ProcessAiResponseFn = useCallback(
    async (
      aiData,
      themeContextForResponse,
      draftState,
      options
    ) => {
      const { baseStateSnapshot, isFromDialogueSummary = false, scoreChangeFromAction = 0 } = options;

      const turnChanges: TurnChanges = {
        itemChanges: [],
        characterChanges: [],
        objectiveAchieved: false,
        objectiveTextChanged: false,
        mainQuestTextChanged: false,
        localTimeChanged: false,
        localEnvironmentChanged: false,
        localPlaceChanged: false,
        currentMapNodeIdChanged: false,
        scoreChangedBy: scoreChangeFromAction,
        mapDataChanged: false,
      };

      if (!aiData) {
        setError('The Dungeon Master\'s connection is unstable... (Invalid AI response after retries)');
        if (!isFromDialogueSummary && 'actionOptions' in draftState) {
          draftState.actionOptions = [
            'Try to wait for the connection to improve.',
            'Consult the ancient network spirits.',
            'Check your own connection.',
            'Sigh dramatically.',
          ];
        }
        draftState.lastActionLog = 'The Dungeon Master seems to be having trouble communicating the outcome of your last action.';
        draftState.localTime = draftState.localTime ?? 'Time Unknown';
        draftState.localEnvironment = draftState.localEnvironment ?? 'Environment Undetermined';
        draftState.localPlace = draftState.localPlace ?? 'Undetermined Location';
        draftState.lastTurnChanges = turnChanges;
        draftState.dialogueState = null;
        return;
      }

      draftState.lastDebugPacket = {
        prompt: draftState.lastDebugPacket?.prompt || 'Prompt not captured for this state transition',
        rawResponseText: draftState.lastDebugPacket?.rawResponseText || 'Raw text not captured',
        parsedResponse: aiData,
        timestamp: new Date().toISOString(),
        mapUpdateDebugInfo: null,
        mapPruningDebugInfo: null,
      };

      if (aiData.localTime !== undefined) {
        if (draftState.localTime !== aiData.localTime) turnChanges.localTimeChanged = true;
        draftState.localTime = aiData.localTime;
      }
      if (aiData.localEnvironment !== undefined) {
        if (draftState.localEnvironment !== aiData.localEnvironment) turnChanges.localEnvironmentChanged = true;
        draftState.localEnvironment = aiData.localEnvironment;
      }
      if (aiData.localPlace !== undefined) {
        if (draftState.localPlace !== aiData.localPlace) turnChanges.localPlaceChanged = true;
        draftState.localPlace = aiData.localPlace;
      }

      if (aiData.mainQuest !== undefined) {
        if (draftState.mainQuest !== aiData.mainQuest) turnChanges.mainQuestTextChanged = true;
        draftState.mainQuest = aiData.mainQuest;
      }
      const oldObjectiveText = draftState.currentObjective;
      if (aiData.currentObjective !== undefined) {
        if (draftState.currentObjective !== aiData.currentObjective) turnChanges.objectiveTextChanged = true;
        draftState.currentObjective = aiData.currentObjective;
      }

      if (objectiveAnimationClearTimerRef.current) {
        clearTimeout(objectiveAnimationClearTimerRef.current);
        objectiveAnimationClearTimerRef.current = null;
      }
      let animationToSet: 'success' | 'neutral' | null = null;
      if (aiData.currentObjective !== undefined && aiData.currentObjective !== oldObjectiveText) {
        animationToSet = aiData.objectiveAchieved ? 'success' : 'neutral';
      } else if (aiData.objectiveAchieved && oldObjectiveText !== null) {
        animationToSet = 'success';
      }
      if (animationToSet) {
        draftState.objectiveAnimationType = animationToSet;
        objectiveAnimationClearTimerRef.current = window.setTimeout(() => {
          setGameStateStack((prev) => [{ ...prev[0], objectiveAnimationType: null }, prev[1]]);
          objectiveAnimationClearTimerRef.current = null;
        }, 5000);
      } else {
        draftState.objectiveAnimationType = null;
      }
      turnChanges.objectiveAchieved = aiData.objectiveAchieved || false;
      if (aiData.objectiveAchieved) {
        draftState.score = draftState.score + 1;
        turnChanges.scoreChangedBy += 1;
      }

      if ('sceneDescription' in aiData && aiData.sceneDescription) {
        draftState.currentScene = aiData.sceneDescription;
      }
      if ('options' in aiData && aiData.options && aiData.options.length > 0 && !('dialogueSetup' in aiData && aiData.dialogueSetup)) {
        draftState.actionOptions = aiData.options;
      } else if (!isFromDialogueSummary && !('dialogueSetup' in aiData && aiData.dialogueSetup)) {
        draftState.actionOptions = ['Look around.', 'Ponder your situation.', 'Check your inventory.', 'Wait for something to happen.'];
      }

      const aiItemChangesFromParser = aiData.itemChange || [];
      const correctedAndVerifiedItemChanges: ItemChange[] = [];
      if (themeContextForResponse) {
        for (const change of aiItemChangesFromParser) {
          let currentChange = { ...change };
          if (currentChange.action === 'lose' && typeof currentChange.item === 'string') {
            const itemNameFromAI = currentChange.item;
            const exactMatchInInventory = baseStateSnapshot.inventory.find((invItem) => invItem.name === itemNameFromAI);
            if (!exactMatchInInventory) {
              const originalLoadingReason = loadingReason;
              setLoadingReason('correction');
              const correctedName = await fetchCorrectedName_Service(
                'item',
                itemNameFromAI,
                aiData.logMessage,
                'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
                baseStateSnapshot.inventory.map((item) => item.name),
                themeContextForResponse
              );
              if (correctedName) currentChange.item = correctedName;
              setLoadingReason(originalLoadingReason);
            }
          }
          correctedAndVerifiedItemChanges.push(currentChange);
        }
      } else {
        correctedAndVerifiedItemChanges.push(...aiItemChangesFromParser);
      }
      turnChanges.itemChanges = buildItemChangeRecords(correctedAndVerifiedItemChanges, baseStateSnapshot.inventory);
      draftState.inventory = applyAllItemChanges(correctedAndVerifiedItemChanges, options.forceEmptyInventory ? [] : baseStateSnapshot.inventory);

      let mapAISuggestedNodeIdentifier: string | undefined = undefined;
      if (themeContextForResponse) {
        try {
          mapAISuggestedNodeIdentifier = await handleMapUpdates(
            aiData,
            draftState,
            baseStateSnapshot,
            themeContextForResponse,
            loadingReason,
            setLoadingReason,
            turnChanges
          );
        } catch (mapErr) {
          setError(
            mapErr instanceof Error ? mapErr.message : String(mapErr)
          );
          throw mapErr;
        }
      }

      if (aiData.logMessage) {
        draftState.gameLog = addLogMessageToList(draftState.gameLog, aiData.logMessage, MAX_LOG_MESSAGES);
        draftState.lastActionLog = aiData.logMessage;
      } else if (!isFromDialogueSummary) {
        draftState.lastActionLog = 'The Dungeon Master remains silent on the outcome of your last action.';
      }

      if ('dialogueSetup' in aiData && aiData.dialogueSetup) {
        draftState.actionOptions = [];
        draftState.dialogueState = {
          participants: aiData.dialogueSetup.participants,
          history: aiData.dialogueSetup.initialNpcResponses,
          options: aiData.dialogueSetup.initialPlayerOptions,
        };
      } else if (isFromDialogueSummary) {
        draftState.dialogueState = null;
      }

      draftState.lastTurnChanges = turnChanges;
    }, [loadingReason, setLoadingReason, setError, setGameStateStack]);

  /**
   * Executes a player's chosen action by querying the AI storyteller.
   * On failure, the draft state is rolled back to the base snapshot so no
   * counters or score are affected.
   */
  const executePlayerAction = useCallback(
    async (action: string, isFreeForm: boolean = false) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      setIsLoading(true);
      setLoadingReason('storyteller');
      setError(null);
      setParseErrorCounter(0);
      setFreeFormActionText('');

      const baseStateSnapshot = structuredCloneGameState(currentFullState);
      let scoreChangeFromAction = isFreeForm ? -FREE_FORM_ACTION_COST : 0;

      const currentThemeObj = currentFullState.currentThemeObject;
      if (!currentThemeObj) {
        setError('Critical error: Current theme object not found. Cannot proceed.');
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }

      const recentLogs = currentFullState.gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT);
        const currentThemeMainMapNodes = currentFullState.mapData.nodes.filter(
          n =>
            n.themeName === currentThemeObj.name &&
            n.data.nodeType !== 'feature' &&
            n.data.nodeType !== 'room'
        );
      const currentThemeCharacters = currentFullState.allCharacters.filter((c) => c.themeName === currentThemeObj.name);
      const currentMapNodeDetails = currentFullState.currentMapNodeId
        ? currentFullState.mapData.nodes.find((n) => n.id === currentFullState.currentMapNodeId) ?? null
        : null;

      const prompt = formatMainGameTurnPrompt(
        currentFullState.currentScene,
        action,
        currentFullState.inventory,
        currentFullState.mainQuest,
        currentFullState.currentObjective,
        currentThemeObj,
        recentLogs,
        currentThemeMainMapNodes,
        currentThemeCharacters,
        currentFullState.localTime,
        currentFullState.localEnvironment,
        currentFullState.localPlace,
        playerGenderProp,
        currentFullState.themeHistory,
        currentMapNodeDetails,
        currentFullState.mapData
      );

      let draftState = structuredCloneGameState(currentFullState);
      const debugPacket = {
        prompt,
        rawResponseText: null,
        parsedResponse: null,
        timestamp: new Date().toISOString(),
      };
      draftState.lastDebugPacket = debugPacket;
      if (isFreeForm) draftState.score -= FREE_FORM_ACTION_COST;

      let encounteredError = false;
      try {
        const response = await executeAIMainTurn(prompt, currentThemeObj.systemInstructionModifier);
        if (draftState.lastDebugPacket) draftState.lastDebugPacket.rawResponseText = response.text ?? null;

        const currentThemeMapDataForParse = {
          nodes: draftState.mapData.nodes.filter((n) => n.themeName === currentThemeObj.name),
          edges: draftState.mapData.edges.filter((e) => {
            const sourceNode = draftState.mapData.nodes.find((node) => node.id === e.sourceNodeId);
            const targetNode = draftState.mapData.nodes.find((node) => node.id === e.targetNodeId);
            return sourceNode?.themeName === currentThemeObj.name && targetNode?.themeName === currentThemeObj.name;
          }),
        };

        const parsedData = await parseAIResponse(
          response.text ?? '',
          playerGenderProp,
          currentThemeObj,
          () => setParseErrorCounter(1),
          currentFullState.lastActionLog || undefined,
          currentFullState.currentScene,
          currentThemeCharacters,
          currentThemeMapDataForParse,
          currentFullState.inventory
        );

        await processAiResponse(parsedData, currentThemeObj, draftState, { baseStateSnapshot, scoreChangeFromAction });
      } catch (e: any) {
        encounteredError = true;
        console.error('Error executing player action:', e);
        if (isServerOrClientError(e)) {
          const status = extractStatusFromError(e);
          setError(`AI service error (${status ?? 'unknown'}). Please retry.`);
        } else {
          setError(`The Dungeon Master's connection seems unstable. Error: (${e.message || 'Unknown AI error'}). Please try again or consult the game log.`);
        }
        draftState = structuredCloneGameState(baseStateSnapshot);
        draftState.lastActionLog = `Your action ("${action}") caused a ripple in reality, but the outcome is obscured.`;
        draftState.actionOptions = ['Look around.', 'Ponder the situation.', 'Check your inventory.', 'Try to move on.'];
        draftState.dialogueState = null;
        draftState.lastDebugPacket = { ...debugPacket, error: e.message || String(e) };
      } finally {
        if (!encounteredError) {
          draftState.turnsSinceLastShift += 1;
          draftState.globalTurnNumber += 1;
        }
        commitGameState(draftState);
        setIsLoading(false);
        setLoadingReason(null);

        if (!draftState.isCustomGameMode && !draftState.dialogueState && currentThemeObj) {
          const stabilityThreshold = currentThemeObj.name === draftState.pendingNewThemeNameAfterShift ? 0 : stabilityLevelProp;
          if (draftState.turnsSinceLastShift > stabilityThreshold && Math.random() * 100 < chaosLevelProp) {
            setError('CHAOS SHIFT! Reality fractures without warning!');
            triggerRealityShift(true);
          }
        }
      }
    }, [
      getCurrentGameState,
      commitGameState,
      isLoading,
      playerGenderProp,
      stabilityLevelProp,
      chaosLevelProp,
      triggerRealityShift,
      setIsLoading,
      setLoadingReason,
      setError,
      setParseErrorCounter,
      setFreeFormActionText,
      processAiResponse,
    ]);

  const handleActionSelect = useCallback(
    (action: string) => {
      const currentFullState = getCurrentGameState();
      if (action === 'Try to force your way back to the previous reality.') {
        const previousThemeName = Object.keys(currentFullState.themeHistory).pop();
        if (previousThemeName) {
          const statePreparedForShift = {
            ...currentFullState,
            pendingNewThemeNameAfterShift: previousThemeName,
          } as FullGameState;
          setGameStateStack((prev) => [statePreparedForShift, prev[1]]);

          if (currentFullState.isCustomGameMode) {
            executeManualRealityShift();
          } else {
            triggerRealityShift();
          }
        } else {
          setError('No previous reality to return to.');
        }
      } else {
        executePlayerAction(action);
      }
    }, [getCurrentGameState, executePlayerAction, triggerRealityShift, setError, setGameStateStack, executeManualRealityShift]);

  const handleItemInteraction = useCallback(
    (item: Item, interactionType: 'generic' | 'specific' | 'inspect', knownUse?: KnownUse) => {
      if (interactionType === 'inspect') {
        executePlayerAction(`Inspect: ${item.name}`);
      } else if (interactionType === 'specific' && knownUse) {
        executePlayerAction(knownUse.promptEffect);
      } else if (interactionType === 'generic') {
        executePlayerAction(`Attempt to use: ${item.name}`);
      }
    },
    [executePlayerAction]
  );

  const handleDiscardJunkItem = useCallback(
    (itemName: string) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      const itemToDiscard = currentFullState.inventory.find((item) => item.name === itemName);
      if (!itemToDiscard || !itemToDiscard.isJunk) return;

      let draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.filter((item) => item.name !== itemName);
      const itemChangeRecord: ItemChangeRecord = { type: 'loss', lostItem: { ...itemToDiscard } };
      const turnChangesForDiscard: TurnChanges = {
        itemChanges: [itemChangeRecord],
        characterChanges: [],
        objectiveAchieved: false,
        objectiveTextChanged: false,
        mainQuestTextChanged: false,
        localTimeChanged: false,
        localEnvironmentChanged: false,
        localPlaceChanged: false,
        currentMapNodeIdChanged: false,
        scoreChangedBy: 0,
        mapDataChanged: false,
      };
      draftState.lastTurnChanges = turnChangesForDiscard;
      commitGameState(draftState);
    },
    [getCurrentGameState, commitGameState, isLoading]
  );

  const handleFreeFormActionSubmit = useCallback(() => {
    const currentFullState = getCurrentGameState();
    if (
      freeFormActionText.trim() &&
      currentFullState.score >= FREE_FORM_ACTION_COST &&
      !isLoading &&
      hasGameBeenInitialized &&
      !currentFullState.dialogueState
    ) {
      executePlayerAction(freeFormActionText.trim(), true);
    }
  }, [freeFormActionText, getCurrentGameState, isLoading, hasGameBeenInitialized, executePlayerAction]);

  const handleUndoTurn = useCallback(() => {
    setGameStateStack((prevStack) => {
      const [current, previous] = prevStack;
      if (previous && current.globalTurnNumber > 0) {
        if (objectiveAnimationClearTimerRef.current) {
          clearTimeout(objectiveAnimationClearTimerRef.current);
          objectiveAnimationClearTimerRef.current = null;
        }
        return [previous, current];
      }
      return prevStack;
    });
  }, [setGameStateStack]);

  return {
    processAiResponse,
    executePlayerAction,
    handleActionSelect,
    handleItemInteraction,
    handleDiscardJunkItem,
    handleFreeFormActionSubmit,
    handleUndoTurn,
  };
};
