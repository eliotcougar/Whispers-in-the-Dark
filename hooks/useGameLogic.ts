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
import { buildSaveStateSnapshot } from './saveSnapshotHelpers';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { PLAYER_HOLDER_ID, DISTILL_LORE_INTERVAL } from '../constants';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';
import { distillFacts_Service } from '../services/loremaster';
import { applyThemeFactChanges } from '../utils/gameLogicUtils';

export interface UseGameLogicProps {
  playerGenderProp: string;
  enabledThemePacksProp: Array<ThemePackName>;
  stabilityLevelProp: number;
  chaosLevelProp: number;
  onSettingsUpdateFromLoad: (
    loadedSettings: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks' | 'stabilityLevel' | 'chaosLevel'>>
  ) => void;
  initialSavedStateFromApp: GameStateStack | null;
  isAppReady: boolean;
  openDebugLoreModal: (
    facts: Array<string>,
    resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void,
  ) => void;
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
    openDebugLoreModal,
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

  const gatherGameStateStackForSave = useCallback((): GameStateStack => {
    const [current, previous] = gameStateStack;
    return [
      buildSaveStateSnapshot({
        currentState: current,
        playerGender: playerGenderProp,
        enabledThemePacks: enabledThemePacksProp,
        stabilityLevel: stabilityLevelProp,
        chaosLevel: chaosLevelProp,
      }),
      previous
        ? buildSaveStateSnapshot({
            currentState: previous,
            playerGender: playerGenderProp,
            enabledThemePacks: enabledThemePacksProp,
            stabilityLevel: stabilityLevelProp,
            chaosLevel: chaosLevelProp,
          })
        : undefined,
    ];
  }, [
    gameStateStack,
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
  ]);

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

  const currentSnapshot = getCurrentGameState();

  const toggleDebugLore = useCallback(() => {
    setGameStateStack(prev => [
      { ...prev[0], debugLore: !prev[0].debugLore },
      prev[1],
    ]);
  }, []);

  const clearDebugFacts = useCallback(() => {
    setGameStateStack(prev => [
      { ...prev[0], debugGoodFacts: [], debugBadFacts: [] },
      prev[1],
    ]);
  }, []);


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
    handleStashToggle,
    updateItemContent,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    recordPlayerJournalInspect,
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
    debugLore: currentSnapshot.debugLore,
    openDebugLoreModal,
  });

  const {
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
    setGameStateStack,
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
        dialogueTranscript:
          preparedGameState.gameLog[preparedGameState.gameLog.length - 1] ?? '',
      }).then(() => {
        draftState.lastDebugPacket ??= {
          prompt: '',
          rawResponseText: null,
          parsedResponse: null,
          timestamp: new Date().toISOString(),
          storytellerThoughts: null,
          mapUpdateDebugInfo: null,
          inventoryDebugInfo: null,
          loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null, journal: null },
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

  const handleDistillFacts = useCallback(async () => {
    const currentFullState = getCurrentGameState();
    const themeObj = currentFullState.currentThemeObject;
    if (!themeObj) return;
    setIsLoading(true);
    setError(null);
    const currentThemeNodes = currentFullState.mapData.nodes.filter(
      n => n.themeName === themeObj.name,
    );
    const inventoryItemNames = Array.from(
      new Set(
        currentFullState.inventory
          .filter(item => {
            if (item.holderId === PLAYER_HOLDER_ID) return true;
            if (currentThemeNodes.some(node => node.id === item.holderId)) return true;
            const holderNpc = currentFullState.allNPCs.find(
              npc => npc.id === item.holderId && npc.themeName === themeObj.name,
            );
            return Boolean(holderNpc);
          })
          .map(item => item.name),
      ),
    );
    const mapNodeNames = currentThemeNodes.map(n => n.placeName);
    setLoadingReason('loremaster_refine');
    const result = await distillFacts_Service({
      themeName: themeObj.name,
      facts: currentFullState.themeFacts,
      currentQuest: currentFullState.mainQuest,
      currentObjective: currentFullState.currentObjective,
      inventoryItemNames,
      mapNodeNames,
    });
    const draftState = structuredCloneGameState(currentFullState);
    draftState.lastLoreDistillTurn = currentFullState.globalTurnNumber;
    draftState.lastDebugPacket ??= {
      prompt: '',
      rawResponseText: null,
      parsedResponse: null,
      timestamp: new Date().toISOString(),
      storytellerThoughts: null,
      mapUpdateDebugInfo: null,
      inventoryDebugInfo: null,
      loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null, journal: null },
      dialogueDebugInfo: null,
    };
    if (draftState.lastDebugPacket.loremasterDebugInfo) {
      draftState.lastDebugPacket.loremasterDebugInfo.distill = result?.debugInfo ?? null;
    }
    if (result?.refinementResult) {
      applyThemeFactChanges(
        draftState,
        result.refinementResult.factsChange,
        draftState.globalTurnNumber,
        themeObj.name,
      );
    }
    commitGameState(draftState);
    setIsLoading(false);
    setLoadingReason(null);
  }, [commitGameState, getCurrentGameState, setError, setIsLoading, setLoadingReason]);

  useEffect(() => {
    if (
      !hasGameBeenInitialized ||
      isLoading ||
      currentFullState.dialogueState !== null
    )
      return;
    if (
      currentFullState.globalTurnNumber > 0 &&
      (currentFullState.globalTurnNumber - 1) % DISTILL_LORE_INTERVAL === 0 &&
      currentFullState.lastLoreDistillTurn !== currentFullState.globalTurnNumber
    ) {
      void handleDistillFacts();
    }
  }, [
    currentFullState.globalTurnNumber,
    currentFullState.lastLoreDistillTurn,
    handleDistillFacts,
    hasGameBeenInitialized,
    isLoading,
    currentFullState.dialogueState,
  ]);

  return {
    currentTheme: currentFullState.currentThemeObject,
    currentScene: currentFullState.currentScene,
    actionOptions: currentFullState.actionOptions,
    mainQuest: currentFullState.mainQuest,
    currentObjective: currentFullState.currentObjective,
    inventory: currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
    playerJournal: currentFullState.playerJournal,
    lastJournalWriteTurn: currentFullState.lastJournalWriteTurn,
    lastJournalInspectTurn: currentFullState.lastJournalInspectTurn,
    lastLoreDistillTurn: currentFullState.lastLoreDistillTurn,
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
    allNPCs: currentFullState.allNPCs,
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
    gatherCurrentGameState: gatherGameStateStackForSave,
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
    handleStashToggle,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    recordPlayerJournalInspect,
    commitGameState,
    handleDistillFacts,
    toggleDebugLore,
    clearDebugFacts,
    debugLore: currentFullState.debugLore,
    debugGoodFacts: currentFullState.debugGoodFacts,
    debugBadFacts: currentFullState.debugBadFacts,
  };
};
