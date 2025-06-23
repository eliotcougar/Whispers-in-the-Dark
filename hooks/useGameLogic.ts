/**
 * @file useGameLogic.ts
 * @description Central hook that coordinates game state and orchestrates other hooks.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ThemePackName, FullGameState, GameStateStack, LoadingReason } from '../types';
import { getInitialGameStates } from '../utils/initialStates';
import { useDialogueManagement } from './useDialogueManagement';
import { useRealityShift } from './useRealityShift';
import { useGameTurn } from './useGameTurn';
import { useGameInitialization, LoadInitialGameOptions } from './useGameInitialization';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { PLAYER_HOLDER_ID } from '../constants';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';

export interface UseGameLogicProps {
  playerGenderProp: string;
  enabledThemePacksProp: Array<ThemePackName>;
  stabilityLevelProp: number;
  chaosLevelProp: number;
  onSettingsUpdateFromLoad: (
    loadedSettings: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks' | 'stabilityLevel' | 'chaosLevel'>>
  ) => void;
  initialSavedStateFromApp: FullGameState | null;
  isAppReady: boolean;
}

/** Manages overall game state and delegates to sub hooks. */
export const useGameLogic = (props: UseGameLogicProps) => {
  const {
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
    onSettingsUpdateFromLoad,
    initialSavedStateFromApp,
    isAppReady,
  } = props;

  const [gameStateStack, setGameStateStack] = useState<GameStateStack>(() => [getInitialGameStates(), getInitialGameStates()]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingReason, setLoadingReason] = useState<LoadingReason>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseErrorCounter, setParseErrorCounter] = useState<number>(0);
  void parseErrorCounter;
  const [freeFormActionText, setFreeFormActionText] = useState<string>('');
  const [hasGameBeenInitialized, setHasGameBeenInitialized] = useState<boolean>(false);

  // Tracks whether a saved game from app initialization has already been
  // applied to prevent re-loading it when starting a new game.
  const hasLoadedInitialSave = useRef<boolean>(false);

  const triggerShiftRef = useRef<(c?: boolean) => void>(() => undefined);
  const manualShiftRef = useRef<() => void>(() => undefined);
  const loadInitialGameRef = useRef<(opts: LoadInitialGameOptions) => Promise<void>>(
    () => Promise.resolve(),
  );

  const getCurrentGameState = useCallback((): FullGameState => gameStateStack[0], [gameStateStack]);
  const commitGameState = useCallback((newGameState: FullGameState) => {
    setGameStateStack(prev => [newGameState, prev[0]]);
  }, []);

  /**
   * Replaces the entire game state stack with a blank state.
   */
  const resetGameStateStack = useCallback((newState: FullGameState) => {
    setGameStateStack([newState, newState]);
  }, []);

  const {
    triggerRealityShift,
    executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection,
  } = useRealityShift({
    getCurrentGameState,
    setGameStateStack,
    loadInitialGame: (opts) => { void loadInitialGameRef.current(opts); },
    enabledThemePacksProp,
    playerGenderProp,
    stabilityLevelProp,
    chaosLevelProp,
    setError,
    setLoadingReason,
    isLoading,
  });

  triggerShiftRef.current = triggerRealityShift;
  manualShiftRef.current = executeManualRealityShift;

  const {
    handleMapLayoutConfigChange,
    handleMapViewBoxChange,
    handleMapNodesPositionChange,
    handleSelectDestinationNode,
    processAiResponse,
    handleActionSelect,
    handleItemInteraction,
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    addJournalEntry,
    handleFreeFormActionSubmit,
    handleUndoTurn,
  } = useGameTurn({
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
  });

  const {
    gatherCurrentGameStateForSave,
    loadInitialGame,
    handleStartNewGameFromButton,
    startCustomGame,
    executeRestartGame,
    handleRetry,
  } = useGameInitialization({
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
    setIsLoading,
    setLoadingReason,
    setError,
    setParseErrorCounter,
    setHasGameBeenInitialized,
    onSettingsUpdateFromLoad,
    getCurrentGameState,
    commitGameState,
    resetGameStateStack,
    processAiResponse,
  });
  loadInitialGameRef.current = loadInitialGame;


  const { isDialogueExiting, handleDialogueOptionSelect, handleForceExitDialogue } = useDialogueManagement({
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded: (summaryPayload, preparedGameState, debugInfo) => {
      const draftState = structuredCloneGameState(preparedGameState);
      processAiResponse(summaryPayload, preparedGameState.currentThemeObject, draftState, {
        baseStateSnapshot: structuredCloneGameState(preparedGameState),
        isFromDialogueSummary: true,
        playerActionText: undefined,
      }).then(() => {
        draftState.lastDebugPacket ??= {
          prompt: '',
          rawResponseText: null,
          parsedResponse: null,
          timestamp: new Date().toISOString(),
          storytellerThoughts: null,
          mapUpdateDebugInfo: null,
          inventoryDebugInfo: null,
          loremasterDebugInfo: null,
          dialogueDebugInfo: null,
        };
        draftState.lastDebugPacket.prompt = `[Dialogue Outcome]\n${debugInfo.summaryPrompt ?? draftState.lastDebugPacket.prompt}`;
        draftState.lastDebugPacket.rawResponseText = debugInfo.summaryRawResponse ?? null;
        draftState.lastDebugPacket.storytellerThoughts = debugInfo.summaryThoughts ?? null;
        draftState.lastDebugPacket.parsedResponse = summaryPayload;
        draftState.lastDebugPacket.dialogueDebugInfo = debugInfo;
        commitGameState(draftState);
        setIsLoading(false);
        setLoadingReason(null);
      }).catch((e: unknown) => {
        console.error('Error in post-dialogue processAiResponse:', e);
        setError('Failed to fully process dialogue conclusion. Game state might be inconsistent.');
        commitGameState(preparedGameState);
        setIsLoading(false);
        setLoadingReason(null);
      });
    },
  });

  useEffect(() => {
    if (
      isAppReady &&
      !hasGameBeenInitialized &&
      initialSavedStateFromApp &&
      !hasLoadedInitialSave.current
    ) {
      void loadInitialGame({ savedStateToLoad: initialSavedStateFromApp });
      hasLoadedInitialSave.current = true;
    }
  }, [isAppReady, hasGameBeenInitialized, initialSavedStateFromApp, loadInitialGame]);

  const currentFullState = getCurrentGameState();

  useEffect(() => {
    if (!hasGameBeenInitialized) return;
    setGameStateStack(prevStack => {
      const curr = prevStack[0];
      const packsEqual =
        curr.enabledThemePacks.length === enabledThemePacksProp.length &&
        curr.enabledThemePacks.every((p, i) => p === enabledThemePacksProp[i]);

      if (
        curr.playerGender === playerGenderProp &&
        packsEqual &&
        curr.stabilityLevel === stabilityLevelProp &&
        curr.chaosLevel === chaosLevelProp
      ) {
        return prevStack;
      }

      const updatedCurrent = {
        ...curr,
        playerGender: playerGenderProp,
        enabledThemePacks: [...enabledThemePacksProp],
        stabilityLevel: stabilityLevelProp,
        chaosLevel: chaosLevelProp,
      } as FullGameState;

      return [updatedCurrent, prevStack[1]];
    });
  }, [
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
    hasGameBeenInitialized,
  ]);

  const itemPresenceByNode = useMemo(() => {
    const map: Record<string, { hasUseful: boolean; hasVehicle: boolean } | undefined> = {};
    const nodeIds = new Set(currentFullState.mapData.nodes.map(n => n.id));
    currentFullState.inventory.forEach(item => {
      if (nodeIds.has(item.holderId)) {
        const entry = map[item.holderId] ?? { hasUseful: false, hasVehicle: false };
        if (!item.tags?.includes('junk')) entry.hasUseful = true;
        if (item.type === 'vehicle') entry.hasVehicle = true;
        map[item.holderId] = entry;
      }
    });
    return map;
  }, [currentFullState.inventory, currentFullState.mapData.nodes]);

  return {
    currentTheme: currentFullState.currentThemeObject,
    currentScene: currentFullState.currentScene,
    actionOptions: currentFullState.actionOptions,
    mainQuest: currentFullState.mainQuest,
    currentObjective: currentFullState.currentObjective,
    inventory: currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
    itemsHere: useMemo(() => {
      if (!currentFullState.currentMapNodeId) return [];
      const atCurrent = currentFullState.inventory.filter(
        i => i.holderId === currentFullState.currentMapNodeId
      );
      const adjIds = getAdjacentNodeIds(
        currentFullState.mapData,
        currentFullState.currentMapNodeId
      );
      const nearbyItems = currentFullState.inventory.filter(i =>
        adjIds.includes(i.holderId)
      );
      const combined = [...atCurrent];
      nearbyItems.forEach(it => {
        if (!combined.includes(it)) combined.push(it);
      });
      return combined;
    }, [
      currentFullState.currentMapNodeId,
      currentFullState.inventory,
      currentFullState.mapData,
    ]),
    itemPresenceByNode,
    gameLog: currentFullState.gameLog,
    lastActionLog: currentFullState.lastActionLog,
    isLoading: isLoading || (currentFullState.dialogueState !== null && isDialogueExiting),
    loadingReason,
    error,
    themeHistory: currentFullState.themeHistory,
    allCharacters: currentFullState.allCharacters,
    mapData: currentFullState.mapData,
    currentMapNodeId: currentFullState.currentMapNodeId,
    destinationNodeId: currentFullState.destinationNodeId,
    mapLayoutConfig: currentFullState.mapLayoutConfig,
    mapViewBox: currentFullState.mapViewBox,
    score: currentFullState.score,
    freeFormActionText,
    setFreeFormActionText,
    handleFreeFormActionSubmit,
    objectiveAnimationType: currentFullState.objectiveAnimationType,
    localTime: currentFullState.localTime,
    localEnvironment: currentFullState.localEnvironment,
    localPlace: currentFullState.localPlace,
    turnsSinceLastShift: currentFullState.turnsSinceLastShift,
    globalTurnNumber: currentFullState.globalTurnNumber,
    isCustomGameMode: currentFullState.isCustomGameMode,
    isAwaitingManualShiftThemeSelection: currentFullState.isAwaitingManualShiftThemeSelection,

    dialogueState: currentFullState.dialogueState,
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,

    lastDebugPacket: currentFullState.lastDebugPacket,
    lastTurnChanges: currentFullState.lastTurnChanges,
    gameStateStack,

    handleActionSelect,
    handleItemInteraction,
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    handleRetry,
    executeRestartGame,
    executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection,
    startCustomGame,
    gatherCurrentGameState: gatherCurrentGameStateForSave,
    applyLoadedGameState: loadInitialGame,
    setError,
    setIsLoading,
    hasGameBeenInitialized,
    handleStartNewGameFromButton,
    handleMapLayoutConfigChange,
    handleMapViewBoxChange,
    handleMapNodesPositionChange,
    handleSelectDestinationNode,
    handleUndoTurn,
    addJournalEntry,
    commitGameState,
  };
};
