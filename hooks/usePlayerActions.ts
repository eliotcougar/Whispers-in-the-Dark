/**
 * @file usePlayerActions.ts
 * @description Hook that handles player actions and AI response processing.
 */

import { useCallback, useRef } from 'react';
import {
  GameStateFromAI,
  DialogueSummaryResponse,
  Item,
  ItemReference,
  KnownUse,
  AdventureTheme,
  FullGameState,
  GameStateStack,
  ItemChange,
  ItemChangeRecord,
  LoadingReason,
  TurnChanges,
} from '../types';
import {
  executeAIMainTurn,
  parseAIResponse,
  buildMainGameTurnPrompt
} from '../services/storyteller';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';
import { fetchCorrectedName_Service } from '../services/corrections';
import {
  FREE_FORM_ACTION_COST,
  MAX_LOG_MESSAGES,
  RECENT_LOG_COUNT_FOR_PROMPT,
  PLAYER_HOLDER_ID,
} from '../constants';
import {
  addLogMessageToList,
  buildItemChangeRecords,
  applyAllItemChanges,
} from '../utils/gameLogicUtils';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { handleMapUpdates } from '../utils/mapUpdateHandlers';
import { formatInventoryForPrompt } from '../utils/promptFormatters/inventory';
import { applyInventoryHints_Service } from '../services/inventory';

export interface ProcessAiResponseOptions {
  forceEmptyInventory?: boolean;
  baseStateSnapshot: FullGameState;
  isFromDialogueSummary?: boolean;
  scoreChangeFromAction?: number;
  playerActionText?: string;
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
      const { baseStateSnapshot, isFromDialogueSummary = false, scoreChangeFromAction = 0, playerActionText } = options;

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
        ...(draftState.lastDebugPacket ?? {}),
        prompt:
          draftState.lastDebugPacket?.prompt ||
          'Prompt not captured for this state transition',
        rawResponseText:
          draftState.lastDebugPacket?.rawResponseText || 'Raw text not captured',
        parsedResponse: aiData,
        timestamp: new Date().toISOString(),
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
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
          const currentChange = { ...change };
          if (currentChange.action === 'destroy' && currentChange.item) {
            const itemRef = currentChange.item as ItemReference;
            const itemNameFromAI = itemRef.name;
            const exactMatchInInventory = baseStateSnapshot.inventory
              .filter(i => i.holderId === PLAYER_HOLDER_ID)
              .find(invItem =>
                (itemRef.id && invItem.id === itemRef.id) ||
                (itemRef.name && invItem.name === itemRef.name)
              );
            if (!exactMatchInInventory) {
              const originalLoadingReason = loadingReason;
              setLoadingReason('correction');
              const correctedName = await fetchCorrectedName_Service(
                'item',
                itemNameFromAI || '',
                aiData.logMessage,
                'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
                baseStateSnapshot.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID).map((item) => item.name),
                themeContextForResponse
              );
              if (correctedName) {
                currentChange.item = { id: correctedName, name: correctedName };
              }
              setLoadingReason(originalLoadingReason);
            }

            const dropText = `${aiData.logMessage || ''} ${'sceneDescription' in aiData ? aiData.sceneDescription : ''} ${playerActionText || ''}`.toLowerCase();
            const dropIndicators = ['drop', 'dropped', 'leave', 'left', 'put down', 'set down', 'place', 'placed'];
            if (dropIndicators.some(word => dropText.includes(word))) {
              const invItem = baseStateSnapshot.inventory.find(i =>
                i.holderId === PLAYER_HOLDER_ID &&
                ((itemRef.id && i.id === itemRef.id) || (itemRef.name && i.name.toLowerCase() === itemRef.name.toLowerCase()))
              );
              if (invItem) {
                currentChange.action = 'put';
                currentChange.item = { ...invItem, holderId: baseStateSnapshot.currentMapNodeId || 'unknown' } as Item;
              }
            }
          }
          correctedAndVerifiedItemChanges.push(currentChange);
        }
      } else {
        correctedAndVerifiedItemChanges.push(...aiItemChangesFromParser);
      }
      const baseInventoryForPlayer = baseStateSnapshot.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID);
      const locationInventory = baseStateSnapshot.inventory.filter(
        i => i.holderId === baseStateSnapshot.currentMapNodeId
      );
      const companionChars = baseStateSnapshot.allCharacters.filter(
        c => c.presenceStatus === 'companion'
      );
      const nearbyChars = baseStateSnapshot.allCharacters.filter(
        c => c.presenceStatus === 'nearby'
      );

      const formatCharInventoryList = (chars: typeof companionChars): string => {
        if (chars.length === 0) return 'None.';
        return chars
          .map(ch => {
            const items = baseStateSnapshot.inventory.filter(i => i.holderId === ch.id);
            return `ID: ${ch.id} - ${ch.name}: ${formatInventoryForPrompt(items)}`;
          })
          .join('\n');
      };

      let combinedItemChanges = [...correctedAndVerifiedItemChanges];

      if (themeContextForResponse) {
        try {
          await handleMapUpdates(
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

      if (themeContextForResponse) {
        const invResult = await applyInventoryHints_Service(
          'playerItemsHint' in aiData ? aiData.playerItemsHint : undefined,
          'worldItemsHint' in aiData ? aiData.worldItemsHint : undefined,
          'npcItemsHint' in aiData ? aiData.npcItemsHint : undefined,
          ('newItems' in aiData && Array.isArray(aiData.newItems)) ? aiData.newItems : [],
          playerActionText || '',
          formatInventoryForPrompt(baseInventoryForPlayer),
          formatInventoryForPrompt(locationInventory),
          baseStateSnapshot.currentMapNodeId || null,
          formatCharInventoryList(companionChars),
          formatCharInventoryList(nearbyChars),
          'sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene,
          aiData.logMessage,
          themeContextForResponse
        );
        if (invResult) {
          combinedItemChanges = combinedItemChanges.concat(invResult.itemChanges);
          if (draftState.lastDebugPacket)
            draftState.lastDebugPacket.inventoryDebugInfo = invResult.debugInfo;
        }
      }

      turnChanges.itemChanges = buildItemChangeRecords(combinedItemChanges, baseInventoryForPlayer);
      draftState.inventory = applyAllItemChanges(
        combinedItemChanges,
        options.forceEmptyInventory ? [] : baseStateSnapshot.inventory
      );

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
      const scoreChangeFromAction = isFreeForm ? -FREE_FORM_ACTION_COST : 0;

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

      const locationItems = currentFullState.inventory.filter(
        i =>
          i.holderId !== PLAYER_HOLDER_ID &&
          i.holderId === currentFullState.currentMapNodeId
      );
      const prompt = buildMainGameTurnPrompt(
        currentFullState.currentScene,
        action,
        currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
        locationItems,
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
        currentFullState.mapData,
        currentFullState.destinationNodeId
      );

      let draftState = structuredCloneGameState(currentFullState);
      const debugPacket = {
        prompt,
        rawResponseText: null,
        parsedResponse: null,
        timestamp: new Date().toISOString(),
        storytellerThoughts: null,
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
        dialogueDebugInfo: null,
      };
      draftState.lastDebugPacket = debugPacket;
      if (isFreeForm) draftState.score -= FREE_FORM_ACTION_COST;

      let encounteredError = false;
      try {
        const { response, thoughts } = await executeAIMainTurn(
          prompt,
          currentThemeObj.systemInstructionModifier,
        );
        if (draftState.lastDebugPacket) {
          draftState.lastDebugPacket.rawResponseText = response.text ?? null;
          draftState.lastDebugPacket.storytellerThoughts = thoughts;
        }

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
          currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID)
        );

        await processAiResponse(parsedData, currentThemeObj, draftState, { baseStateSnapshot, scoreChangeFromAction, playerActionText: action });
      } catch (e) {
        encounteredError = true;
        console.error('Error executing player action:', e);
        if (isServerOrClientError(e)) {
          const status = extractStatusFromError(e);
          setError(`AI service error (${status ?? 'unknown'}). Please retry.`);
        } else {
          const errMsg = e instanceof Error ? e.message : String(e);
          setError(`The Dungeon Master's connection seems unstable. Error: (${errMsg}). Please try again or consult the game log.`);
        }
        draftState = structuredCloneGameState(baseStateSnapshot);
        draftState.lastActionLog = `Your action ("${action}") caused a ripple in reality, but the outcome is obscured.`;
        draftState.actionOptions = ['Look around.', 'Ponder the situation.', 'Check your inventory.', 'Try to move on.'];
        draftState.dialogueState = null;
        draftState.lastDebugPacket = { ...debugPacket, error: e instanceof Error ? e.message : String(e) };
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

  /**
   * Handles a player's menu selection or special shift action.
   * @param action - The action string chosen by the player.
   */
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
        void executePlayerAction(action);
      }
    }, [getCurrentGameState, executePlayerAction, triggerRealityShift, setError, setGameStateStack, executeManualRealityShift]);

  /**
   * Triggers an action based on the player's interaction with an item.
   */
  const handleItemInteraction = useCallback(
    (item: Item, interactionType: 'generic' | 'specific' | 'inspect', knownUse?: KnownUse) => {
      if (interactionType === 'inspect') {
        void executePlayerAction(`Inspect: ${item.name}`);
      } else if (interactionType === 'specific' && knownUse) {
        void executePlayerAction(knownUse.promptEffect);
      } else if (interactionType === 'generic') {
        void executePlayerAction(`Attempt to use: ${item.name}`);
      }
    },
    [executePlayerAction]
  );

  /**
   * Drops an item from the inventory at the current location and optionally logs a message.
   */
  const handleDropItem = useCallback(
    (itemName: string, logMessageOverride?: string) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      const itemToDiscard = currentFullState.inventory.find((item) => item.name === itemName && item.holderId === PLAYER_HOLDER_ID);
      if (!itemToDiscard) return;

      const draftState = structuredCloneGameState(currentFullState);
      const currentLocationId = currentFullState.currentMapNodeId || 'unknown';
      draftState.inventory = draftState.inventory.map((item) =>
        item.name === itemName && item.holderId === PLAYER_HOLDER_ID
          ? { ...item, holderId: currentLocationId }
          : item
      );
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

      let logMessage = logMessageOverride;
      if (!logMessage) {
        const placeName =
          currentFullState.mapData.nodes.find(n => n.id === currentLocationId)?.placeName ||
          currentFullState.localPlace ||
          'Unknown Place';
        if (itemToDiscard.type === 'vehicle' && !itemToDiscard.isActive) {
          logMessage = `You left your ${itemName} parked at ${placeName}.`;
        } else {
          logMessage = `You left your ${itemName} at ${placeName}.`;
        }
      }

      if (logMessage) {
        draftState.gameLog = addLogMessageToList(draftState.gameLog, logMessage, MAX_LOG_MESSAGES);
        draftState.lastActionLog = logMessage;
      }
      commitGameState(draftState);
    },
    [getCurrentGameState, commitGameState, isLoading]
  );

  /**
   * Picks up an item from the current location without triggering a turn.
   */
  const handleTakeLocationItem = useCallback(
    (itemName: string) => {
      const currentFullState = getCurrentGameState();
      if (isLoading || currentFullState.dialogueState) return;

      const currentLocationId = currentFullState.currentMapNodeId;
      if (!currentLocationId) return;

      const itemToTake = currentFullState.inventory.find(
        (item) => item.name === itemName && item.holderId === currentLocationId
      );
      if (!itemToTake) return;

      const draftState = structuredCloneGameState(currentFullState);
      draftState.inventory = draftState.inventory.map((item) =>
        item.name === itemName && item.holderId === currentLocationId
          ? { ...item, holderId: PLAYER_HOLDER_ID }
          : item
      );

      const itemChangeRecord: ItemChangeRecord = {
        type: 'gain',
        gainedItem: { ...itemToTake, holderId: PLAYER_HOLDER_ID },
      };
      const turnChangesForTake: TurnChanges = {
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
      draftState.lastTurnChanges = turnChangesForTake;
      commitGameState(draftState);
    },
    [getCurrentGameState, commitGameState, isLoading]
  );

  /**
   * Executes the player's typed free-form action if allowed.
   */
  const handleFreeFormActionSubmit = useCallback(() => {
    const currentFullState = getCurrentGameState();
    if (
      freeFormActionText.trim() &&
      currentFullState.score >= FREE_FORM_ACTION_COST &&
      !isLoading &&
      hasGameBeenInitialized &&
      !currentFullState.dialogueState
    ) {
      void executePlayerAction(freeFormActionText.trim(), true);
    }
  }, [freeFormActionText, getCurrentGameState, isLoading, hasGameBeenInitialized, executePlayerAction]);

  /**
   * Restores the previous turn's game state if available.
   */
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
    handleDropItem,
    handleTakeLocationItem,
    handleFreeFormActionSubmit,
    handleUndoTurn,
  };
};
