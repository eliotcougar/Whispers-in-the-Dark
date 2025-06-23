/**
 * @file usePlayerActions.ts
 * @description Hook that handles player actions and AI response processing.
 */

import { useCallback } from 'react';
import {
  KnownUse,
  Item,
  FullGameState,
  GameStateStack,
  LoadingReason,
} from '../types';
import {
  executeAIMainTurn,
  parseAIResponse,
  buildMainGameTurnPrompt
} from '../services/storyteller';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';
import {
  FREE_FORM_ACTION_COST,
  RECENT_LOG_COUNT_FOR_PROMPT,
  PLAYER_HOLDER_ID,
} from '../constants';

import { structuredCloneGameState } from '../utils/cloneUtils';
import { useProcessAiResponse } from './useProcessAiResponse';
import { useInventoryActions } from './useInventoryActions';

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

  const { processAiResponse, clearObjectiveAnimationTimer } = useProcessAiResponse({
    loadingReason,
    setLoadingReason,
    setError,
    setGameStateStack,
  });

  const { handleDropItem, handleTakeLocationItem, updateItemContent, addJournalEntry, recordInspect } = useInventoryActions({
    getCurrentGameState,
    commitGameState,
    isLoading,
  });

  /**
   * Executes a player's chosen action by querying the AI storyteller.
   * On failure, the draft state is rolled back to the base snapshot so no
   * counters or score are affected.
   */
  const executePlayerAction = useCallback(
    async (
      action: string,
      isFreeForm = false,
      overrideState?: FullGameState,
    ) => {
      const currentFullState = overrideState ?? getCurrentGameState();
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
        draftState.lastDebugPacket = {
          ...draftState.lastDebugPacket,
          rawResponseText: response.text ?? null,
          storytellerThoughts: thoughts,
        };

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
          () => { setParseErrorCounter(1); },
          currentFullState.lastActionLog ?? undefined,
          currentFullState.currentScene,
          currentThemeCharacters,
          currentThemeMapDataForParse,
          currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID)
        );

        await processAiResponse(parsedData, currentThemeObj, draftState, { baseStateSnapshot, scoreChangeFromAction, playerActionText: action });
      } catch (e: unknown) {
        encounteredError = true;
        console.error('Error executing player action:', e);
        if (isServerOrClientError(e)) {
          const status = extractStatusFromError(e);
          setError(`AI service error (${String(status ?? 'unknown')}). Please retry.`);
        } else {
          const errMsg = e instanceof Error ? e.message : String(e);
          setError(`The Dungeon Master's connection seems unstable. Error: (${errMsg}). Please try again or consult the game log.`);
        }
        draftState = structuredCloneGameState(baseStateSnapshot);
        draftState.lastActionLog = `Your action ("${action}") caused a ripple in reality, but the outcome is obscured.`;
        draftState.actionOptions = [
          'Look around.',
          'Ponder the situation.',
          'Check your inventory.',
          'Try to move on.',
          'Consider your objective.',
          'Plan your next steps.'
        ];
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

        if (!draftState.isCustomGameMode && !draftState.dialogueState) {
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
    (
      item: Item,
      interactionType: 'generic' | 'specific' | 'inspect',
      knownUse?: KnownUse,
    ) => {
      if (interactionType === 'inspect') {
        const updatedState = recordInspect(item.id);
        const showActual = item.tags?.includes('recovered');
        const contents = (item.chapters ?? [])
          .map(
            ch =>
              `${ch.heading}\n${showActual ? ch.actualContent ?? '' : ch.visibleContent ?? ''}\n\n`,
          )
          .join('');
        void executePlayerAction(
          `Player reads the ${item.name} - ${item.description}. Here's what the player reads:\n${contents}`,
          false,
          updatedState,
        );
      } else if (interactionType === 'specific' && knownUse) {
        void executePlayerAction(knownUse.promptEffect);
      } else if (interactionType === 'generic') {
        void executePlayerAction(`Attempt to use: ${item.name}`);
      }
    },
    [executePlayerAction, recordInspect]
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
        clearObjectiveAnimationTimer();
        return [previous, current];
      }
      return prevStack;
    });
  }, [setGameStateStack, clearObjectiveAnimationTimer]);

  return {
    processAiResponse,
    executePlayerAction,
    handleActionSelect,
    handleItemInteraction,
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    addJournalEntry,
    handleFreeFormActionSubmit,
    handleUndoTurn,
  };
};
