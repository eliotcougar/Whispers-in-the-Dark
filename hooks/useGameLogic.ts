/**
 * @file useGameLogic.ts
 * @description Central hook that coordinates game state and orchestrates other hooks.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ThemePackName,
  FullGameState,
  GameStateStack,
  DebugPacket,
  DebugPacketStack,
  LoadingReason,
  AdventureTheme,
  WorldSheet,
  CharacterOption,
  HeroSheet,
  HeroBackstory,
  StoryAct,
  StoryArc,
  ThinkingEffort,
  Item,
  KnownUse,
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
    ACTION_POINTS_PER_TURN,
    KNOWN_USE_ACTION_COST,
    GENERIC_USE_ACTION_COST,
    INSPECT_ACTION_COST,
    WRITTEN_ITEM_TYPES,
  } from '../constants';
import { getAdjacentNodeIds } from '../utils/mapGraphUtils';
import { distillFacts } from '../services/loremaster';
import { applyLoreFactChanges } from '../utils/gameLogicUtils';
import {
  ensureCoreGameStateIntegrity,
  ensureCoreGameStateStackIntegrity,
} from '../utils/gameStateIntegrity';

export interface UseGameLogicProps {
  enabledThemePacksProp: Array<ThemePackName>;
  thinkingEffortProp: ThinkingEffort;
  preferredPlayerNameProp?: string;
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
      heroGender: string;
      WorldSheet: WorldSheet;
      options: Array<CharacterOption>;
    },
    onHeroData: (result: {
      name: string;
      heroSheet: HeroSheet | null;
      heroBackstory: HeroBackstory | null;
      storyArc: StoryArc | null;
    }) => Promise<void>,
  ) => Promise<void>;
  openGenderSelectModal: (defaultGender: string) => Promise<string>;
  onActIntro: (act: StoryAct) => void;
}

/** Manages overall game state and delegates to sub hooks. */
export const useGameLogic = (props: UseGameLogicProps) => {
  const {
    enabledThemePacksProp,
    thinkingEffortProp,
    preferredPlayerNameProp,
    initialSavedStateFromApp,
    initialDebugStackFromApp,
    isAppReady,
    openDebugLoreModal,
    openCharacterSelectModal,
    openGenderSelectModal,
    onActIntro,
  } = props;

  const initialGameStateStack = useMemo(() => {
    const current = getInitialGameStates();
    const previous = structuredCloneGameState(current);
    return [current, previous] as GameStateStack;
  }, []);
  const [gameStateStackValue, setGameStateStackValue] = useState(initialGameStateStack);
  const [debugPacketStack, setDebugPacketStack] = useState<DebugPacketStack>(
    () => initialDebugStackFromApp ?? [null, null],
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTurnProcessing, setIsTurnProcessing] = useState<boolean>(false);
  const loadingReason = useLoadingReason();
  const loadingReasonRef = useRef<LoadingReason | null>(loadingReason);
  const setLoadingReasonRef = useCallback((reason: LoadingReason | null) => {
    loadingReasonRef.current = reason;
    setGlobalLoadingReason(reason);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [parseErrorCounter, setParseErrorCounter] = useState<number>(0);
  const [freeFormActionText, setFreeFormActionText] = useState<string>('');
  const [hasGameBeenInitialized, setHasGameBeenInitialized] = useState<boolean>(false);
  const [queuedItemActions, setQueuedItemActions] = useState<
    Array<{ id: string; displayText: string; promptText: string; cost: number; effect?: () => void }>
  >([]);

  const totalQueuedActionCost = useMemo(
    () => queuedItemActions.reduce((sum, a) => sum + a.cost, 0),
    [queuedItemActions],
  );
  const remainingActionPoints = ACTION_POINTS_PER_TURN - totalQueuedActionCost;

  // Tracks whether a saved game from app initialization has already been
  // applied to prevent re-loading it when starting a new game.
  const hasLoadedInitialSave = useRef<boolean>(false);
  // Tracks whether the debug packet stack from app initialization has been
  // applied so it doesn't overwrite new data on subsequent renders.
  const hasLoadedInitialDebugStack = useRef<boolean>(false);

  const loadInitialGameRef = useRef<(opts: LoadInitialGameOptions) => Promise<void>>(
    () => Promise.resolve(),
  );

  const actIntroRef = useRef<StoryAct | null>(null);

  const setGameStateStack = useCallback(
    (update: React.SetStateAction<GameStateStack>) => {
      setGameStateStackValue(prev => {
        const next = typeof update === 'function'
          ? (update as (stack: GameStateStack) => GameStateStack)(prev)
          : update;
        const current = ensureCoreGameStateIntegrity(next[0], 'setGameStateStack.current');
        const previous = ensureCoreGameStateStackIntegrity(next[1], 'setGameStateStack.previous');
        return [current, previous];
      });
    },
    [],
  );

  const getCurrentGameState = useCallback((): FullGameState => gameStateStackValue[0], [gameStateStackValue]);
  const commitGameState = useCallback((newGameState: FullGameState) => {
    const sanitized = ensureCoreGameStateIntegrity(newGameState, 'commitGameState');
    let fallbackDebugForAwaiting: DebugPacket | null = null;
    setGameStateStack(prev => {
      const [prevCurrent, prevPrevious] = prev;
      if (sanitized.turnState === 'awaiting_input') {
        const fallbackPrevState = prevCurrent.turnState === 'awaiting_input'
          ? prevCurrent
          : prevPrevious ?? prevCurrent;
        fallbackDebugForAwaiting = fallbackPrevState.lastDebugPacket ?? null;
        return [sanitized, fallbackPrevState];
      }
      return [sanitized, prevCurrent];
    });
    setDebugPacketStack(prev => {
      const nextCurrentDebug = sanitized.lastDebugPacket ?? null;
      if (sanitized.turnState === 'awaiting_input') {
        return [nextCurrentDebug, fallbackDebugForAwaiting];
      }
      return [nextCurrentDebug, prev[0]];
    });
  }, [setGameStateStack, setDebugPacketStack]);

  /**
   * Replaces the entire game state stack with a blank state.
   */
  const resetGameStateStack = useCallback((newState: FullGameState) => {
    const sanitized = ensureCoreGameStateIntegrity(newState, 'resetGameStateStack');
    setGameStateStack(() => [sanitized, sanitized]);
    const debugPacket = sanitized.lastDebugPacket ?? null;
    setDebugPacketStack([debugPacket, debugPacket]);
  }, [setGameStateStack, setDebugPacketStack]);

  const gatherGameStateStackForSave = useCallback((): GameStateStack => {
    const [current, previous] = gameStateStackValue;
    return [
      buildSaveStateSnapshot({
        currentState: current,
      }),
      previous ? buildSaveStateSnapshot({ currentState: previous }) : undefined,
    ];
  }, [gameStateStackValue]);

  const gatherDebugPacketStackForSave = useCallback((): DebugPacketStack => debugPacketStack, [debugPacketStack]);

  // Reality shift mechanics removed

  const currentSnapshot = getCurrentGameState();

  const toggleDebugLore = useCallback(() => {
    setGameStateStack(prev => [
      { ...prev[0], debugLore: !prev[0].debugLore },
      prev[1],
    ]);
  }, [setGameStateStack]);

  const clearDebugFacts = useCallback(() => {
    setGameStateStack(prev => [
      { ...prev[0], debugGoodFacts: [], debugBadFacts: [] },
      prev[1],
    ]);
  }, [setGameStateStack]);


  const {
    handleMapLayoutConfigChange,
    handleMapViewBoxChange,
    handleMapNodesPositionChange,
    handleSelectDestinationNode,
    processAiResponse,
    handleActionSelect,
    handleItemInteraction: executeItemInteraction,
    handleDropItem,
    handleDiscardItem,
    handleTakeLocationItem,
    handleStashToggle,
    updateItemContent,
    addJournalEntry,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    recordPlayerJournalInspect,
    recordInspect,
    handleFreeFormActionSubmit,
    handleUndoTurn,
    triggerMainQuestAchieved,
    simulateVictory,
    spawnBookForPlayer,
    spawnMapForPlayer,
    spawnPictureForPlayer,
    spawnPageForPlayer,
    spawnVehicleForPlayer,
    spawnNpcAtPlayerLocation,
  } = useGameTurn({
    getCurrentGameState,
    commitGameState,
    setGameStateStack,
    setIsLoading,
    setIsTurnProcessing,
    setLoadingReason: setLoadingReasonRef,
    setError,
    setParseErrorCounter,
    freeFormActionText,
    setFreeFormActionText,
    isLoading,
    isTurnProcessing,
    hasGameBeenInitialized,
    loadingReasonRef,
    debugLore: currentSnapshot.debugLore,
    openDebugLoreModal,
    actIntroRef,
    onActIntro,
  });

    const toggleQueuedAction = useCallback(
      (action: { id: string; displayText: string; promptText: string; cost: number; effect?: () => void }) => {
        setQueuedItemActions(prev => {
          const exists = prev.some(a => a.id === action.id);
          return exists ? prev.filter(a => a.id !== action.id) : [...prev, action];
        });
      },
      [],
    );

  const clearQueuedItemActions = useCallback(() => {
    setQueuedItemActions([]);
  }, []);

    const queueItemAction = useCallback(
      (
        item: Item,
        interactionType: 'generic' | 'specific' | 'inspect' | 'take' | 'drop' | 'discard',
        knownUse?: KnownUse,
      ) => {
        if (interactionType === 'take') {
          handleTakeLocationItem(item.id);
          return;
        }
        if (interactionType === 'drop') {
          handleDropItem(item.id);
          return;
        }
        if (interactionType === 'discard') {
          handleDiscardItem(item.id);
          return;
        }

        let id = '';
        let displayText = '';
        let promptText = '';
        let effect: (() => void) | undefined;
        let cost = 0;

        switch (interactionType) {
          case 'inspect': {
            id = `${item.id}-inspect`;
            displayText = `Inspect the ${item.name}`;
            effect = () => {
              recordInspect(item.id);
            };
            cost = INSPECT_ACTION_COST;
            if (WRITTEN_ITEM_TYPES.includes(item.type as (typeof WRITTEN_ITEM_TYPES)[number])) {
              const showActual = item.tags?.includes('recovered');
              const contents = (item.chapters ?? [])
                .map(ch => `${ch.heading}\n${showActual ? ch.actualContent ?? '' : ch.visibleContent ?? ''}`)
                .join('\n\n');
              promptText = `Player reads the ${item.name} - ${item.description}. Here's what the player reads:\n${contents}`;
            } else {
              promptText = `Player investigates the ${item.name} - ${item.description}.`;
            }
            break;
          }
          case 'generic':
            id = `${item.id}-generic`;
            displayText = `Attempt to use the ${item.name}`;
            promptText = `Attempt to use: ${item.name}`;
            cost = GENERIC_USE_ACTION_COST;
            break;
          case 'specific':
            if (knownUse) {
              id = `${item.id}-specific-${knownUse.actionName}`;
              displayText = knownUse.actionName;
              promptText = knownUse.promptEffect;
              cost = KNOWN_USE_ACTION_COST;
            }
            break;
          default:
            break;
        }

        if (id && displayText && promptText) {
          const isQueued = queuedItemActions.some(a => a.id === id);
          if (!isQueued && cost > remainingActionPoints) return;
          toggleQueuedAction({ id, displayText, promptText, cost, effect });
        }
      },
      [
        handleDropItem,
        handleDiscardItem,
        handleTakeLocationItem,
        toggleQueuedAction,
        recordInspect,
        queuedItemActions,
        remainingActionPoints,
      ],
    );

  const {
    loadInitialGame,
    handleStartNewGameFromButton,
    startCustomGame,
    executeRestartGame,
    handleRetry,
  } = useGameInitialization({
    enabledThemePacksProp,
    thinkingEffortProp,
    preferredPlayerNameProp,
    setIsLoading,
    setLoadingReason: setLoadingReasonRef,
    setError,
    setParseErrorCounter,
    setHasGameBeenInitialized,
    getCurrentGameState,
    commitGameState,
    resetGameStateStack,
    setGameStateStack,
    processAiResponse,
    openCharacterSelectModal,
    openGenderSelectModal,
    onActIntro,
  });
  loadInitialGameRef.current = loadInitialGame;


const { isDialogueExiting, handleDialogueOptionSelect, handleForceExitDialogue } = useDialogueManagement({
  getCurrentGameState,
  commitGameState,
  setError,
  setIsLoading,
  setLoadingReason: setLoadingReasonRef,
  onDialogueConcluded: (summaryPayload, preparedGameState, debugInfo) => {
      const draftState = structuredCloneGameState(preparedGameState);
      return processAiResponse(summaryPayload, draftState, {
        baseStateSnapshot: structuredCloneGameState(preparedGameState),
        isFromDialogueSummary: true,
        playerActionText: undefined,
        dialogueTranscript:
          preparedGameState.gameLog[preparedGameState.gameLog.length - 1] ?? '',
        onBeforeRefine: (state) => {
          // Show the new scene and any applied map/inventory changes
          commitGameState(state);
        },
        setIsLoading: setIsLoading,
        setIsTurnProcessing: setIsTurnProcessing,
      })
        .then(() => {
          // After summary is applied, return to awaiting input
          draftState.turnState = 'awaiting_input';
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
          setIsTurnProcessing(false);
          setIsLoading(false);
          setLoadingReasonRef(null);
        })
        .catch((e: unknown) => {
          console.error('Error in post-dialogue processAiResponse:', e);
          setError('Failed to fully process dialogue conclusion. Game state might be inconsistent.');
          preparedGameState.turnState = 'awaiting_input';
          commitGameState(preparedGameState);
          setIsTurnProcessing(false);
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

  // Keep startState at 'title' while app ready but game not initialized
  useEffect(() => {
    if (isAppReady && !hasGameBeenInitialized) {
      setGameStateStack(prev => {
        const curr = prev[0];
        if (curr.startState !== 'title') {
          return [{ ...curr, startState: 'title' } as FullGameState, prev[1]];
        }
        return prev;
      });
    }
  }, [isAppReady, hasGameBeenInitialized, setGameStateStack]);

  // Keep current state's enabled theme packs in sync with user settings
  useEffect(() => {
    if (!hasGameBeenInitialized) return;
    setGameStateStack(prevStack => {
      const curr = prevStack[0];
      const packsEqual =
        curr.enabledThemePacks.length === enabledThemePacksProp.length &&
        curr.enabledThemePacks.every((p, i) => p === enabledThemePacksProp[i]);
      if (packsEqual) return prevStack;
      const updatedCurrent = {
        ...curr,
        enabledThemePacks: [...enabledThemePacksProp],
      } as FullGameState;
      return [updatedCurrent, prevStack[1]];
    });
  }, [enabledThemePacksProp, hasGameBeenInitialized, setGameStateStack]);

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
    setIsLoading(true);
    setError(null);
    const mapNodes = currentFullState.mapData.nodes;
    const inventoryItemNames = Array.from(
      new Set(
        currentFullState.inventory
          .filter(item => {
            if (item.holderId === PLAYER_HOLDER_ID) return true;
            if (mapNodes.some(node => node.id === item.holderId)) return true;
            const holderNpc = currentFullState.allNPCs.find(
              npc => npc.id === item.holderId,
            );
            return Boolean(holderNpc);
          })
          .map(item => item.name),
      ),
    );
    const mapNodeNames = mapNodes.map(n => n.placeName);
    const recentLogs = currentFullState.gameLog.slice(-RECENT_LOG_COUNT_FOR_DISTILL);
    setLoadingReasonRef('loremaster_distill');
    const storyArcActs = currentFullState.storyArc.acts;
    const actIndex = currentFullState.storyArc.currentAct - 1;
    const act = actIndex >= 0 && actIndex < storyArcActs.length
      ? storyArcActs[actIndex]
      : null;
    const actQuest = act ? act.mainObjective : null;
    const result = await distillFacts({
      themeName: currentFullState.theme.name,
      facts: currentFullState.loreFacts,
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
      applyLoreFactChanges(
        draftState,
        result.refinementResult.factsChange,
        draftState.globalTurnNumber,
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

  const arcActs = currentFullState.storyArc.acts;
  const currentActIndex = currentFullState.storyArc.currentAct - 1;
  const currentAct = currentActIndex >= 0 && currentActIndex < arcActs.length
    ? arcActs[currentActIndex]
    : null;
  const mainQuest = currentAct ? currentAct.mainObjective : null;

  return {
    theme: currentFullState.theme,
    currentScene: currentFullState.currentScene,
    actionOptions: currentFullState.actionOptions,
    mainQuest,
    storyArc: currentFullState.storyArc,
    heroSheet: currentFullState.heroSheet,
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
    isLoading: isLoading,
    isTurnProcessing,
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

    isVictory: currentFullState.isVictory,
    lastDebugPacket: debugPacketStack[0],
    lastTurnChanges: currentFullState.lastTurnChanges,
    gameStateStack: gameStateStackValue,
    debugPacketStack,

    handleActionSelect,
    executeItemInteraction,
    handleDropItem,
    handleDiscardItem,
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
    simulateVictory,
    spawnBookForPlayer,
    spawnMapForPlayer,
    spawnPictureForPlayer,
    spawnPageForPlayer,
    spawnVehicleForPlayer,
    spawnNpcAtPlayerLocation,
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
    queueItemAction,
    queuedItemActions,
    clearQueuedItemActions,
    remainingActionPoints,
    parseErrorCounter,
  };
};
