/**
 * @file useGameLogic.ts
 * @description Central hook that coordinates game state and orchestrates other hooks.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ThemePackName,
  FullGameState,
  GameStateStack,
  DebugPacketStack,
  LoadingReason,
  AdventureTheme,
  WorldFacts,
  CharacterOption,
  HeroSheet,
  HeroBackstory,
  StoryArc,
} from '../types';
import { setLoadingReason as setGlobalLoadingReason } from '../utils/loadingState';
import { useLoadingReason } from './useLoadingReason';
import { getInitialGameStates } from '../utils/initialStates';
import { useDialogueManagement } from './useDialogueManagement';
import { useGameTurn } from './useGameTurn';
import { useGameInitialization, LoadInitialGameOptions } from './useGameInitialization';
import { buildSaveStateSnapshot } from './saveSnapshotHelpers';
import { structuredCloneGameState } from '../utils/cloneUtils';
import {
  PLAYER_HOLDER_ID,
  DISTILL_LORE_INTERVAL,
  RECENT_LOG_COUNT_FOR_DISTILL,
} from '../constants';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';
import { distillFacts_Service } from '../services/loremaster';
import { applyThemeFactChanges } from '../utils/gameLogicUtils';

export interface UseGameLogicProps {
  playerGenderProp: string;
  enabledThemePacksProp: Array<ThemePackName>;
  onSettingsUpdateFromLoad: (
    loadedSettings: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks'>>
  ) => void;
  initialSavedStateFromApp: GameStateStack | null;
  initialDebugStackFromApp: DebugPacketStack | null;
  isAppReady: boolean;
  openDebugLoreModal: (
    facts: Array<string>,
    resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void,
  ) => void;
  openCharacterSelectModal: (
    data: {
      theme: AdventureTheme;
      playerGender: string;
      worldFacts: WorldFacts;
      options: Array<CharacterOption>;
    },
  ) => Promise<{
    name: string;
    heroSheet: HeroSheet | null;
    heroBackstory: HeroBackstory | null;
    storyArc: StoryArc | null;
  }>;
}

/** Manages overall game state and delegates to sub hooks. */
export const useGameLogic = (props: UseGameLogicProps) => {
  const {
    playerGenderProp,
    enabledThemePacksProp,
    onSettingsUpdateFromLoad,
    initialSavedStateFromApp,
    initialDebugStackFromApp,
    isAppReady,
    openDebugLoreModal,
    openCharacterSelectModal,
  } = props;

  const [gameStateStack, setGameStateStack] = useState<GameStateStack>(() => [getInitialGameStates(), getInitialGameStates()]);
  const [debugPacketStack, setDebugPacketStack] = useState<DebugPacketStack>(
    () => initialDebugStackFromApp ?? [null, null],
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const loadingReason = useLoadingReason();
  const loadingReasonRef = useRef<LoadingReason | null>(loadingReason);
  const setLoadingReasonRef = useCallback((reason: LoadingReason | null) => {
    loadingReasonRef.current = reason;
    setGlobalLoadingReason(reason);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [parseErrorCounter, setParseErrorCounter] = useState<number>(0);
  void parseErrorCounter;
  const [freeFormActionText, setFreeFormActionText] = useState<string>('');
  const [hasGameBeenInitialized, setHasGameBeenInitialized] = useState<boolean>(false);

  // Tracks whether a saved game from app initialization has already been
  // applied to prevent re-loading it when starting a new game.
  const hasLoadedInitialSave = useRef<boolean>(false);
  // Tracks whether the debug packet stack from app initialization has been
  // applied so it doesn't overwrite new data on subsequent renders.
  const hasLoadedInitialDebugStack = useRef<boolean>(false);

  const loadInitialGameRef = useRef<(opts: LoadInitialGameOptions) => Promise<void>>(
    () => Promise.resolve(),
  );

  const getCurrentGameState = useCallback((): FullGameState => gameStateStack[0], [gameStateStack]);
  const commitGameState = useCallback((newGameState: FullGameState) => {
    setGameStateStack(prev => [newGameState, prev[0]]);
    setDebugPacketStack(prev => [newGameState.lastDebugPacket ?? null, prev[0]]);
  }, []);

  /**
   * Replaces the entire game state stack with a blank state.
   */
  const resetGameStateStack = useCallback((newState: FullGameState) => {
    setGameStateStack([newState, newState]);
    setDebugPacketStack([newState.lastDebugPacket ?? null, newState.lastDebugPacket ?? null]);
  }, []);

  const gatherGameStateStackForSave = useCallback((): GameStateStack => {
    const [current, previous] = gameStateStack;
    return [
      buildSaveStateSnapshot({
        currentState: current,
        playerGender: playerGenderProp,
        enabledThemePacks: enabledThemePacksProp,
      }),
      previous
        ? buildSaveStateSnapshot({
            currentState: previous,
            playerGender: playerGenderProp,
            enabledThemePacks: enabledThemePacksProp,
          })
        : undefined,
    ];
  }, [
    gameStateStack,
    playerGenderProp,
    enabledThemePacksProp,
  ]);

  const gatherDebugPacketStackForSave = useCallback((): DebugPacketStack => debugPacketStack, [debugPacketStack]);

  // Reality shift mechanics removed

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
    triggerMainQuestAchieved,
  } = useGameTurn({
    getCurrentGameState,
    commitGameState,
    setGameStateStack,
    playerGenderProp,
    setIsLoading,
    setLoadingReason: setLoadingReasonRef,
    setError,
    setParseErrorCounter,
    freeFormActionText,
    setFreeFormActionText,
    isLoading,
    hasGameBeenInitialized,
    loadingReasonRef,
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
    setIsLoading,
    setLoadingReason: setLoadingReasonRef,
    setError,
    setParseErrorCounter,
    setHasGameBeenInitialized,
    onSettingsUpdateFromLoad,
    getCurrentGameState,
    commitGameState,
    resetGameStateStack,
    setGameStateStack,
    processAiResponse,
    openCharacterSelectModal,
  });
  loadInitialGameRef.current = loadInitialGame;


  const { isDialogueExiting, handleDialogueOptionSelect, handleForceExitDialogue } = useDialogueManagement({
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason: setLoadingReasonRef,
    onDialogueConcluded: (summaryPayload, preparedGameState, debugInfo) => {
      const draftState = structuredCloneGameState(preparedGameState);
      return processAiResponse(summaryPayload, preparedGameState.currentThemeObject, draftState, {
        baseStateSnapshot: structuredCloneGameState(preparedGameState),
        isFromDialogueSummary: true,
        playerActionText: undefined,
        dialogueTranscript:
          preparedGameState.gameLog[preparedGameState.gameLog.length - 1] ?? '',
      })
        .then(() => {
          draftState.lastDebugPacket ??= {
            prompt: '',
            rawResponseText: null,
            parsedResponse: null,
            timestamp: new Date().toISOString(),
            storytellerThoughts: null,
            mapUpdateDebugInfo: null,
            inventoryDebugInfo: null,
            librarianDebugInfo: null,
            loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null },
            dialogueDebugInfo: null,
          };
          draftState.lastDebugPacket.prompt = `[Dialogue Outcome]\n${debugInfo.summaryPrompt ?? draftState.lastDebugPacket.prompt}`;
          draftState.lastDebugPacket.rawResponseText = debugInfo.summaryRawResponse ?? null;
          draftState.lastDebugPacket.storytellerThoughts = debugInfo.summaryThoughts ?? null;
          draftState.lastDebugPacket.parsedResponse = summaryPayload;
          draftState.lastDebugPacket.dialogueDebugInfo = debugInfo;
          commitGameState(draftState);
          setIsLoading(false);
          setLoadingReasonRef(null);
        })
        .catch((e: unknown) => {
          console.error('Error in post-dialogue processAiResponse:', e);
          setError('Failed to fully process dialogue conclusion. Game state might be inconsistent.');
          commitGameState(preparedGameState);
          setIsLoading(false);
          setLoadingReasonRef(null);
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

  useEffect(() => {
    if (
      isAppReady &&
      initialDebugStackFromApp &&
      !hasLoadedInitialDebugStack.current
    ) {
      setDebugPacketStack(initialDebugStackFromApp);
      hasLoadedInitialDebugStack.current = true;
    }
  }, [isAppReady, initialDebugStackFromApp]);

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
        packsEqual
      ) {
        return prevStack;
      }

      const updatedCurrent = {
        ...curr,
        playerGender: playerGenderProp,
        enabledThemePacks: [...enabledThemePacksProp],
      } as FullGameState;

      return [updatedCurrent, prevStack[1]];
    });
  }, [
    playerGenderProp,
    enabledThemePacksProp,
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
    const recentLogs = currentFullState.gameLog.slice(-RECENT_LOG_COUNT_FOR_DISTILL);
    setLoadingReasonRef('loremaster_refine');
    const act =
      currentFullState.storyArc?.acts[
        currentFullState.storyArc.currentAct - 1
      ];
    const actQuest = act?.mainObjective ?? null;
    const result = await distillFacts_Service({
      themeName: themeObj.name,
      facts: currentFullState.themeFacts,
      currentQuest: actQuest,
      currentObjective: currentFullState.currentObjective,
      inventoryItemNames,
      mapNodeNames,
      recentLogEntries: recentLogs,
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
      librarianDebugInfo: null,
      loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null },
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
    setLoadingReasonRef(null);
  }, [commitGameState, getCurrentGameState, setError, setIsLoading, setLoadingReasonRef]);

  useEffect(() => {
    if (
      !hasGameBeenInitialized ||
      isLoading ||
      currentFullState.dialogueState !== null
    )
      return;
    if (
      currentFullState.globalTurnNumber > 0 &&
      currentFullState.globalTurnNumber % DISTILL_LORE_INTERVAL === 0 &&
      currentFullState.lastLoreDistillTurn !==
        currentFullState.globalTurnNumber
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

  const currentAct =
    currentFullState.storyArc?.acts[
      currentFullState.storyArc.currentAct - 1
    ];
  const mainQuest = currentAct?.mainObjective ?? null;

  return {
    currentTheme: currentFullState.currentThemeObject,
    currentScene: currentFullState.currentScene,
    actionOptions: currentFullState.actionOptions,
    mainQuest,
    storyArc: currentFullState.storyArc,
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
    globalTurnNumber: currentFullState.globalTurnNumber,

    dialogueState: currentFullState.dialogueState,
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,

    lastDebugPacket: debugPacketStack[0],
    lastTurnChanges: currentFullState.lastTurnChanges,
    gameStateStack,
    debugPacketStack,

    handleActionSelect,
    handleItemInteraction,
    handleDropItem,
    handleTakeLocationItem,
    updateItemContent,
    handleRetry,
    executeRestartGame,
    startCustomGame,
    gatherCurrentGameState: gatherGameStateStackForSave,
    gatherDebugPacketStack: gatherDebugPacketStackForSave,
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
    triggerMainQuestAchieved,
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
