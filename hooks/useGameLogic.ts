/**
 * @file useGameLogic.ts
 * @description Central hook that coordinates game state and orchestrates other hooks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ThemePackName, FullGameState, GameStateStack, LoadingReason } from '../types';
import { getInitialGameStates } from '../utils/initialStates';
import { useDialogueFlow } from './useDialogueFlow';
import { useRealityShift } from './useRealityShift';
import { useMapUpdates, getDefaultMapLayoutConfig } from './useMapUpdates';
import { usePlayerActions } from './usePlayerActions';
import { useGameInitialization, LoadInitialGameOptions } from './useGameInitialization';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { PLAYER_HOLDER_ID } from '../constants';

export interface UseGameLogicProps {
  playerGenderProp: string;
  enabledThemePacksProp: ThemePackName[];
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
  const [, setParseErrorCounter] = useState<number>(0);
  const [freeFormActionText, setFreeFormActionText] = useState<string>('');
  const [hasGameBeenInitialized, setHasGameBeenInitialized] = useState<boolean>(false);

  // Tracks whether a saved game from app initialization has already been
  // applied to prevent re-loading it when starting a new game.
  const hasLoadedInitialSave = useRef<boolean>(false);

  const triggerShiftRef = useRef<(c?: boolean) => void>(() => {});
  const manualShiftRef = useRef<() => void>(() => {});
  const loadInitialGameRef = useRef<(opts: LoadInitialGameOptions) => Promise<void>>(async () => {});

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
    handleMapLayoutConfigChange,
    handleMapViewBoxChange,
    handleMapNodesPositionChange,
    handleSelectDestinationNode,
  } = useMapUpdates({ setGameStateStack });

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
    processAiResponse,
    handleActionSelect,
    handleItemInteraction,
    handleDiscardJunkItem,
    handleTakeLocationItem,
    handleFreeFormActionSubmit,
    handleUndoTurn,
  } = usePlayerActions({
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


  const { isDialogueExiting, handleDialogueOptionSelect, handleForceExitDialogue } = useDialogueFlow({
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded: (summaryPayload, preparedGameState) => {
      const draftState = structuredCloneGameState(preparedGameState);
      processAiResponse(summaryPayload, preparedGameState.currentThemeObject, draftState, {
        baseStateSnapshot: structuredCloneGameState(preparedGameState),
        isFromDialogueSummary: true,
      }).then(() => {
        commitGameState(draftState);
        setIsLoading(false);
        setLoadingReason(null);
      }).catch((e) => {
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

  return {
    currentTheme: currentFullState.currentThemeObject,
    currentScene: currentFullState.currentScene,
    actionOptions: currentFullState.actionOptions,
    mainQuest: currentFullState.mainQuest,
    currentObjective: currentFullState.currentObjective,
    inventory: currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
    itemsHere: currentFullState.currentMapNodeId
      ? currentFullState.inventory.filter(i => i.holderId === currentFullState.currentMapNodeId)
      : [],
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
    mapLayoutConfig: currentFullState.mapLayoutConfig || getDefaultMapLayoutConfig(),
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
    isCustomGameMode: currentFullState.isCustomGameMode ?? false,
    isAwaitingManualShiftThemeSelection: currentFullState.isAwaitingManualShiftThemeSelection ?? false,

    dialogueState: currentFullState.dialogueState,
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,

    lastDebugPacket: currentFullState.lastDebugPacket,
    lastTurnChanges: currentFullState.lastTurnChanges,
    gameStateStack,

    handleActionSelect,
    handleItemInteraction,
    handleDiscardJunkItem,
    handleTakeLocationItem,
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
  };
};
