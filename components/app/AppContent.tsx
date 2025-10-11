import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as React from 'react';
import LoadingSpinner from '../LoadingSpinner';
import AppLayout from './AppLayout';
import GameHud from './GameHud';
import AppModalManager from './AppModalManager';
import { generateJournalEntry } from '../../services/journal';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { useSaveLoadActions, type SaveLoadState } from '../../hooks/useSaveLoad';
import { useAutosave } from '../../hooks/useAutosave';
import { buildTravelAdjacency, findTravelPath, type TravelAdjacency, type TravelStep } from '../../utils/mapPathfinding';
import { isDescendantIdOf } from '../../utils/mapGraphUtils';
import { isApiConfigured } from '../../services/geminiClient';
import {
  FREE_FORM_ACTION_COST,
  RECENT_LOG_COUNT_FOR_PROMPT,
  PLAYER_HOLDER_ID,
  PLAYER_JOURNAL_ID,
  JOURNAL_WRITE_COOLDOWN,
  INSPECT_COOLDOWN,
} from '../../constants';
import {
  ThemePackName,
  Item,
  ItemChapter,
  FullGameState,
  ThinkingEffort,
  StoryAct,
} from '../../types';
import { saveDebugLoreToLocalStorage } from '../../services/storage';
import { PLACEHOLDER_THEME } from '../../utils/initialStates';
import { stripMarkupFormatting } from '../../utils/textSanitizers';
import { useGameLogicContext } from '../../hooks/useGameLogicContext';
import { useAppModals } from '../../hooks/useAppModals';

type AppModalsState = ReturnType<typeof useAppModals>;

interface AppContentProps {
  readonly saveLoadState: SaveLoadState;
  readonly appModals: AppModalsState;
  readonly pendingAct: StoryAct | null;
  readonly setPendingAct: (act: StoryAct | null) => void;
}

function AppContent({
  saveLoadState,
  appModals,
  pendingAct,
  setPendingAct,
}: AppContentProps) {
  const { clearProgress } = useLoadingProgress();
  const {
    enabledThemePacks,
    setEnabledThemePacks,
    thinkingEffort,
    setThinkingEffort,
    preferredPlayerName,
    setPreferredPlayerName,
    appReady,
  } = saveLoadState;
  const {
    isVisualizerVisible,
    visualizerImageUrl,
    setVisualizerImageUrl,
    visualizerImageScene,
    setVisualizerImageScene,
    isKnowledgeBaseVisible,
    isSettingsVisible,
    isInfoVisible,
    isMapVisible,
    userRequestedTitleMenuOpen,
    setShouldReturnToTitleMenu,
    shouldReturnToTitleMenu,
    isDebugViewVisible,
    isCustomGameSetupVisible,
    newGameFromMenuConfirmOpen,
    loadGameFromMenuConfirmOpen,
    openVisualizer,
    closeVisualizer,
    openKnowledgeBase,
    closeKnowledgeBase,
    openMap,
    closeMap,
    openSettings: openSettingsModal,
    closeSettings: closeSettingsModal,
    openInfo: openInfoModal,
    closeInfo: closeInfoModal,
    openTitleMenu,
    closeTitleMenu,
    closeDebugView,
    setIsDebugViewVisible,
    openCustomGameSetup,
    closeCustomGameSetup,
    openNewGameFromMenuConfirm,
    closeNewGameFromMenuConfirm,
    openLoadGameFromMenuConfirm,
    closeLoadGameFromMenuConfirm,
    pageItemId,
    pageStartChapterIndex,
    isPageVisible,
    openPageView,
    closePageView,
    isDebugLoreVisible,
    debugLoreFacts,
    isGenderSelectVisible,
    submitGenderSelectModal,
    isCharacterSelectVisible,
    characterSelectData,
    submitCharacterSelectModal,
    submitCharacterSelectHeroData,
    genderSelectDefault,
    submitDebugLoreModal,
    closeDebugLoreModal,
  } = appModals;

  const [geminiKeyVisible, setGeminiKeyVisible] = useState<boolean>(false);

  const gameLogic = useGameLogicContext();
  const {
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
  } = useSaveLoadActions({
    enabledThemePacks,
    thinkingEffort,
  });

  useEffect(() => {
    if (!isApiConfigured()) {
      setGeminiKeyVisible(true);
    }
  }, []);

  const openGeminiKeyModal = useCallback(() => { setGeminiKeyVisible(true); }, []);
  const closeGeminiKeyModal = useCallback(() => { setGeminiKeyVisible(false); }, []);

  const handleThinkingEffortChange = useCallback(
    (value: ThinkingEffort) => {
      setThinkingEffort(value);
      const current = gameLogic.gatherCurrentGameState()[0];
      gameLogic.commitGameState({ ...current, thinkingEffort: value });
    },
    [gameLogic, setThinkingEffort],
  );

  const handlePreferredPlayerNameChange = useCallback((value: string) => {
    setPreferredPlayerName(value);
  }, [setPreferredPlayerName]);

  const {
    theme,
    currentScene, mainQuest, currentObjective, actionOptions, storyArc, heroSheet,
    inventory,
    itemsHere,
    itemPresenceByNode,
    gameLog,
    isLoading,
    isTurnProcessing,
    error,
    lastActionLog,
    mapData,
    currentMapNodeId, mapLayoutConfig,
    allNPCs,
    score, freeFormActionText, setFreeFormActionText,
    handleFreeFormActionSubmit, objectiveAnimationType, handleActionSelect,
    executeItemInteraction, handleRetry,
    startCustomGame,
    gatherCurrentGameState: gatherGameStateStack,
    gatherDebugPacketStack,
    hasGameBeenInitialized,
    localTime, localEnvironment, localPlace,
    dialogueState,
    handleDialogueOptionSelect,
    handleForceExitDialogue,
    isDialogueExiting,
    lastDebugPacket,
    lastTurnChanges,
    globalTurnNumber,
    gameStateStack,
    debugPacketStack,
    handleMapLayoutConfigChange,
    handleUndoTurn,
    triggerMainQuestAchieved,
    destinationNodeId,
    handleSelectDestinationNode,
    mapViewBox,
    handleMapViewBoxChange,
    handleMapNodesPositionChange,
    commitGameState,
    updateItemContent,
    addPlayerJournalEntry,
    updatePlayerJournalContent,
    recordPlayerJournalInspect,
    playerJournal,
    lastJournalWriteTurn,
    lastJournalInspectTurn,
    handleDistillFacts,
    toggleDebugLore,
    clearDebugFacts,
    debugLore,
    debugGoodFacts,
      debugBadFacts,
      isVictory,
      simulateVictory,
      spawnBookForPlayer,
      spawnMapForPlayer,
      spawnPictureForPlayer,
      spawnPageForPlayer,
      spawnVehicleForPlayer,
      spawnNpcAtPlayerLocation,
      handleStashToggle,
      queueItemAction,
      queuedItemActions,
    clearQueuedItemActions,
    remainingActionPoints,
  } = gameLogic;

  const isPlaceholderTheme = theme.name === PLACEHOLDER_THEME.name;
  const adventureNameForUi = isPlaceholderTheme ? null : theme.name;

  const isActTurnGenerating = pendingAct !== null && (isLoading || isTurnProcessing);


  useEffect(() => {
    if (isVictory) {
      setPendingAct(null);
    }
  }, [isVictory, setPendingAct]);

  useEffect(() => {
    if (!lastTurnChanges?.mainQuestAchieved) {
      return;
    }
    triggerMainQuestAchieved().catch((error: unknown) => {
      console.error('Failed to finalize main quest achievement after a turn.', error);
    });
  }, [lastTurnChanges?.mainQuestAchieved, triggerMainQuestAchieved]);

  const handleActContinue = useCallback(() => {
    setPendingAct(null);
  }, [setPendingAct]);


  const handleApplyGameState = useCallback(
    (state: FullGameState) => { commitGameState(state); },
    [commitGameState]
  );

  const handleTriggerMainQuestAchievedClick = useCallback(() => {
    triggerMainQuestAchieved().catch((error: unknown) => {
      console.error('Failed to trigger main quest achievement via debug action.', error);
    });
  }, [triggerMainQuestAchieved]);

  const handleSimulateVictoryClick = useCallback(() => {
    simulateVictory().catch((error: unknown) => {
      console.error('Failed to simulate victory via debug action.', error);
    });
  }, [simulateVictory]);

  const handleSpawnNpcAtLocation = useCallback(() => {
    spawnNpcAtPlayerLocation();
  }, [spawnNpcAtPlayerLocation]);

  const handleSpawnBook = useCallback(() => {
    spawnBookForPlayer();
  }, [spawnBookForPlayer]);

  const handleSpawnMap = useCallback(() => {
    spawnMapForPlayer();
  }, [spawnMapForPlayer]);

  const handleSpawnPicture = useCallback(() => {
    spawnPictureForPlayer();
  }, [spawnPictureForPlayer]);

  const handleSpawnPage = useCallback(() => {
    spawnPageForPlayer();
  }, [spawnPageForPlayer]);

  const handleSpawnVehicle = useCallback(() => {
    spawnVehicleForPlayer();
  }, [spawnVehicleForPlayer]);

  const handleVictoryClose = useCallback(() => {
    commitGameState({ ...gameStateStack[0], isVictory: false });
    openTitleMenu();
  }, [commitGameState, gameStateStack, openTitleMenu]);

  const handleSaveFacts = useCallback((data: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DebugLoreFacts.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleClearFacts = useCallback(() => {
    clearDebugFacts();
    saveDebugLoreToLocalStorage({
      debugLore,
      debugGoodFacts: [],
      debugBadFacts: [],
    });
  }, [clearDebugFacts, debugLore]);

  useEffect(() => {
    if (!isLoading) {
      clearProgress();
    }
  }, [isLoading, clearProgress]);

  const prevGameLogLength = useRef<number>(gameLog.length);
  const prevSceneRef = useRef<string | null>(currentScene);

  const modalState = useMemo(() => {
    const effectiveTitleMenu =
      userRequestedTitleMenuOpen ||
      (appReady && !hasGameBeenInitialized && !isLoading && !isCustomGameSetupVisible);
    const victoryVisible = isVictory;
    const anyModal =
      isVisualizerVisible ||
      isKnowledgeBaseVisible ||
      isSettingsVisible ||
      isInfoVisible ||
      isMapVisible ||
      isDebugViewVisible ||
      isPageVisible ||
      isDebugLoreVisible ||
      effectiveTitleMenu ||
      newGameFromMenuConfirmOpen ||
      loadGameFromMenuConfirmOpen ||
      isCustomGameSetupVisible ||
      geminiKeyVisible ||
      isGenderSelectVisible ||
      isCharacterSelectVisible ||
      victoryVisible ||
      pendingAct !== null;

    return {
      effectiveIsTitleMenuOpen: effectiveTitleMenu,
      isVictoryModalVisible: victoryVisible,
      isAnyModalActive: anyModal,
    };
  }, [
    appReady,
    geminiKeyVisible,
    hasGameBeenInitialized,
    isCharacterSelectVisible,
    isCustomGameSetupVisible,
    isDebugLoreVisible,
    isDebugViewVisible,
    isInfoVisible,
    isKnowledgeBaseVisible,
    isLoading,
    isMapVisible,
    isPageVisible,
    isSettingsVisible,
    isVisualizerVisible,
    isVictory,
    isGenderSelectVisible,
    loadGameFromMenuConfirmOpen,
    newGameFromMenuConfirmOpen,
    pendingAct,
    userRequestedTitleMenuOpen,
  ]);

  const {
    effectiveIsTitleMenuOpen,
    isAnyModalActive,
  } = modalState;

  // For UI blur we also blur during dialogue
  const isAnyModalOrDialogueActive = isAnyModalActive || !!dialogueState;


  useEffect(() => {
    if (currentScene !== prevSceneRef.current || gameLog.length > prevGameLogLength.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevSceneRef.current = currentScene;
    prevGameLogLength.current = gameLog.length;
  }, [currentScene, gameLog.length]);

  useEffect(() => {
    setVisualizerImageUrl(null);
    setVisualizerImageScene(null);
  }, [currentScene, setVisualizerImageUrl, setVisualizerImageScene]);

  useAutosave({
    appReady,
    dependencies: [
      theme,
      currentScene,
      actionOptions,
      mainQuest,
      currentObjective,
      inventory,
      gameLog,
      lastActionLog,
      mapData,
      currentMapNodeId,
      mapLayoutConfig,
      allNPCs,
      score,
      localTime,
      localEnvironment,
      localPlace,
      enabledThemePacks,
      debugLore,
      debugGoodFacts,
      debugBadFacts,
    ],
    dialogueState,
    gatherDebugPacketStack,
    gatherGameStateStack,
    hasGameBeenInitialized,
    isLoading,
    isTurnProcessing,
    setError: (msg) => { gameLogic.setError(msg); },
  });




  const canPerformFreeAction =
    score >= FREE_FORM_ACTION_COST &&
    !isLoading &&
    !isTurnProcessing &&
    hasGameBeenInitialized &&
    !dialogueState;


  const enableMobileTap =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none)').matches;

  const setGeneratedImageCache = useCallback((url: string, scene: string) => {
    setVisualizerImageUrl(url);
    setVisualizerImageScene(scene);
  }, [setVisualizerImageUrl, setVisualizerImageScene]);


  const handleRetryClick = useCallback(() => {
    void handleRetry();
  }, [handleRetry]);

  const handleDistillClick = useCallback(() => {
    void handleDistillFacts();
  }, [handleDistillFacts]);

  const handleReadPage = useCallback(
    (item: Item) => {
      const index =
        item.id === PLAYER_JOURNAL_ID
          ? Math.max(0, (item.chapters?.length ?? 0) - 1)
          : 0;
      openPageView(item.id, index);
    },
    [openPageView]
  );


  const [isPlayerJournalWriting, setIsPlayerJournalWriting] = useState(false);

  const canWritePlayerJournal =
    (lastJournalWriteTurn === 0 ||
      globalTurnNumber - lastJournalWriteTurn >= JOURNAL_WRITE_COOLDOWN) &&
    !isPlayerJournalWriting;
  const canInspectPlayerJournal =
    playerJournal.length > 0 &&
    (lastJournalInspectTurn === 0 ||
      globalTurnNumber - lastJournalInspectTurn >= INSPECT_COOLDOWN);

  const handleReadPlayerJournal = useCallback(() => {
    const index = playerJournal.length > 0 ? playerJournal.length - 1 : 0;
    openPageView(PLAYER_JOURNAL_ID, index);
  }, [openPageView, playerJournal.length]);

  const handleWritePlayerJournal = useCallback(() => {
    const cooldownOver =
      lastJournalWriteTurn === 0 ||
      globalTurnNumber - lastJournalWriteTurn >= JOURNAL_WRITE_COOLDOWN;
    if (!cooldownOver || isPlayerJournalWriting) return;
    setIsPlayerJournalWriting(true);
    openPageView(PLAYER_JOURNAL_ID, playerJournal.length);
    void (async () => {
      if (isPlaceholderTheme) { setIsPlayerJournalWriting(false); return; }
      const { name: themeName, storyGuidance } = theme;
      const prev = playerJournal[playerJournal.length - 1]?.actualContent ?? '';
      const entryLength = Math.floor(Math.random() * 50) + 100;
      const journalResult = await generateJournalEntry(
        entryLength,
        'Personal Journal',
        'Your own journal',
        prev,
        themeName,
        storyGuidance,
        currentScene,
        lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? '',
        mapData.nodes,
        allNPCs,
        gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT),
        mainQuest
      );
      if (journalResult?.entry) {
        const sanitizedHeading = stripMarkupFormatting(journalResult.entry.heading);
        const chapter = {
          heading: sanitizedHeading || 'Journal Entry',
          description: '',
          contentLength: entryLength,
          actualContent: journalResult.entry.text,
        } as ItemChapter;
        addPlayerJournalEntry(chapter, journalResult.debugInfo ?? undefined);
        openPageView(PLAYER_JOURNAL_ID, playerJournal.length);
      }
      setIsPlayerJournalWriting(false);
    })();
  }, [
    allNPCs,
    theme,
    currentScene,
    addPlayerJournalEntry,
    mapData.nodes,
    mainQuest,
    openPageView,
    playerJournal,
    lastDebugPacket,
    gameLog,
    globalTurnNumber,
    lastJournalWriteTurn,
    isPlayerJournalWriting,
    isPlaceholderTheme,
  ]);

  const handleInspectFromPage = useCallback(
    (itemId: string) => {
      if (itemId === PLAYER_JOURNAL_ID) {
        const pseudoItem: Item = {
          id: PLAYER_JOURNAL_ID,
          name: 'Personal Journal',
          type: 'book',
          description: 'Your own journal',
          holderId: PLAYER_HOLDER_ID,
          chapters: playerJournal,
          lastWriteTurn: lastJournalWriteTurn,
          tags: [theme.playerJournalStyle],
        };
        const updatedState = recordPlayerJournalInspect();
        executeItemInteraction(pseudoItem, 'inspect', undefined, updatedState);
        return;
      }

      const item = inventory.find(it => it.id === itemId);
      if (item) {
        executeItemInteraction(item, 'inspect');
      }
    },
    [
      inventory,
      executeItemInteraction,
      playerJournal,
      lastJournalWriteTurn,
      recordPlayerJournalInspect,
      theme,
    ]
  );


  const handleFreeFormActionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFreeFormActionText(e.target.value);
    },
    [setFreeFormActionText]
  );

  const handleCancelLoadGameFromMenu = useCallback(() => {
    closeLoadGameFromMenuConfirm();
    openTitleMenu();
  }, [closeLoadGameFromMenuConfirm, openTitleMenu]);

  const handleCancelNewGameFromMenu = useCallback(() => {
    closeNewGameFromMenuConfirm();
    openTitleMenu();
  }, [closeNewGameFromMenuConfirm, openTitleMenu]);

  const handleToggleThemePackStable = useCallback(
    (packName: ThemePackName) => {
      setEnabledThemePacks(prevPacks => {
        const newPacks = prevPacks.includes(packName)
          ? prevPacks.filter(p => p !== packName)
          : [...prevPacks, packName];
        if (newPacks.length === 0) {
          gameLogic.setError('At least one theme pack must be enabled.');
          return prevPacks;
        }
        return newPacks;
      });
    },
    [gameLogic, setEnabledThemePacks]
  );
  /**
   * Wrapper ensuring lint compliance for the async dialogue option handler.
   */
  const handleDialogueOptionSelectSafe = useCallback(
    (option: string) => {
      void handleDialogueOptionSelect(option);
    },
    [handleDialogueOptionSelect]
  );


  const handleNewGameFromMenu = useCallback(() => {
    closeTitleMenu();
    if (hasGameBeenInitialized) {
      openNewGameFromMenuConfirm();
    } else {
      openCustomGameSetup();
    }
  }, [closeTitleMenu, hasGameBeenInitialized, openCustomGameSetup, openNewGameFromMenuConfirm]);

  const confirmNewGameFromMenu = useCallback(() => {
    closeNewGameFromMenuConfirm();
    openCustomGameSetup();
  }, [closeNewGameFromMenuConfirm, openCustomGameSetup]);

  const handleLoadGameFromMenu = useCallback(() => {
    closeTitleMenu();
    if (hasGameBeenInitialized) {
      openLoadGameFromMenuConfirm();
    } else {
      handleLoadFromFileClick();
    }
  }, [closeTitleMenu, hasGameBeenInitialized, handleLoadFromFileClick, openLoadGameFromMenuConfirm]);

  const confirmLoadGameFromMenu = useCallback(() => {
    closeLoadGameFromMenuConfirm();
    handleLoadFromFileClick();
  }, [closeLoadGameFromMenuConfirm, handleLoadFromFileClick]);

  const handleSaveGameFromMenu = useCallback(async () => {
    closeTitleMenu();
    await handleSaveToFile();
  }, [closeTitleMenu, handleSaveToFile]);

  const openSettingsFromMenu = useCallback(() => {
    closeTitleMenu();
    setShouldReturnToTitleMenu(true);
    openSettingsModal();
  }, [closeTitleMenu, setShouldReturnToTitleMenu, openSettingsModal]);

  const closeSettings = useCallback(() => {
    closeSettingsModal();
    if (shouldReturnToTitleMenu || !hasGameBeenInitialized) {
      openTitleMenu();
    }
    setShouldReturnToTitleMenu(false);
  }, [closeSettingsModal, shouldReturnToTitleMenu, hasGameBeenInitialized, openTitleMenu, setShouldReturnToTitleMenu]);

  const openInfoFromMenu = useCallback(() => {
    closeTitleMenu();
    setShouldReturnToTitleMenu(true);
    openInfoModal();
  }, [closeTitleMenu, setShouldReturnToTitleMenu, openInfoModal]);

  const closeInfo = useCallback(() => {
    closeInfoModal();
    if (shouldReturnToTitleMenu || !hasGameBeenInitialized) {
      openTitleMenu();
    }
    setShouldReturnToTitleMenu(false);
  }, [closeInfoModal, shouldReturnToTitleMenu, hasGameBeenInitialized, openTitleMenu, setShouldReturnToTitleMenu]);



  const handleCloseCustomGameSetup = useCallback(() => {
    closeCustomGameSetup();
    openTitleMenu();
  }, [closeCustomGameSetup, openTitleMenu]);

  const handleCustomThemeSelectedForNewGame = useCallback(
    (themeName: string) => {
      closeCustomGameSetup();
      startCustomGame(themeName);
    },
    [closeCustomGameSetup, startCustomGame]
  );

  const travelAdjacency: TravelAdjacency = React.useMemo(
    () => buildTravelAdjacency(mapData),
    [mapData]
  );
  const travelPath: Array<TravelStep> | null = React.useMemo(() => {
    // Using globalTurnNumber to force recalculation each turn
    void globalTurnNumber;
    if (!destinationNodeId || !currentMapNodeId) return null;
    if (
      currentMapNodeId === destinationNodeId ||
      isDescendantIdOf(mapData, currentMapNodeId, destinationNodeId)
    ) {
      return null;
    }
    return findTravelPath(mapData, currentMapNodeId, destinationNodeId, travelAdjacency);
  }, [destinationNodeId, currentMapNodeId, mapData, travelAdjacency, globalTurnNumber]);

  const showInitialLoadingSpinner = isLoading && !hasGameBeenInitialized && !error;
  const showSceneLoadingOverlay = isLoading && !dialogueState;
  const queuedActionIds = new Set(queuedItemActions.map(action => action.id));

  const mainToolbarProps = {
    adventureName: adventureNameForUi,
    currentSceneExists: !!currentScene,
    isLoading: isLoading || !!dialogueState || isTurnProcessing,
    isTurnProcessing,
    onOpenKnowledgeBase: openKnowledgeBase,
    onOpenMap: openMap,
    onOpenTitleMenu: openTitleMenu,
    onOpenVisualizer: openVisualizer,
    score,
  };

  const sceneDisplayProps = {
    allNPCs,
    description: currentScene,
    inventory,
    lastActionLog,
    localEnvironment,
    localPlace,
    localTime,
    mapData: mapData.nodes,
  };

  const actionOptionsProps = {
    allNPCs,
    disabled: isLoading || isTurnProcessing || !!dialogueState,
    inventory,
    mapData: mapData.nodes,
    onActionSelect: handleActionSelect,
    onClearQueuedActions: clearQueuedItemActions,
    options: actionOptions,
    queuedActions: queuedItemActions,
  };

  const freeActionInputProps = {
    canPerformFreeAction,
    freeFormActionText,
    onChange: handleFreeFormActionChange,
    onSubmit: handleFreeFormActionSubmit,
  };

  const sidebarProps = {
    allNPCs,
    currentMapNodeId,
    currentObjective,
    disabled: isLoading || isTurnProcessing || isAnyModalOrDialogueActive,
    enableMobileTap,
    globalTurnNumber,
    inventory,
    itemsHere,
    mapNodes: mapData.nodes,
    objectiveAnimationType,
    onItemInteract: queueItemAction,
    onReadPage: handleReadPage,
    onReadPlayerJournal: handleReadPlayerJournal,
    onStashToggle: handleStashToggle,
    queuedActionIds,
    remainingActionPoints,
    storyArc,
  };

  const errorBanners = error
    ? [
        {
          id: 'active-game-error',
          isVisible: !isLoading && !dialogueState && hasGameBeenInitialized,
          message: error,
          handleRetry: handleRetryClick,
        },
        {
          id: 'pre-game-error',
          isVisible: !hasGameBeenInitialized,
          message: error,
          handleRetry: handleRetryClick,
        },
      ]
    : [];

  const itemAnimatorProps = {
    currentTurnNumber: globalTurnNumber,
    isGameBusy: isLoading || isTurnProcessing || isAnyModalActive,
    lastTurnChanges,
  };

  const footerProps = {
    isBlurred: isAnyModalOrDialogueActive,
    isDebugViewVisible,
    setIsDebugViewVisible,
  };

  const fileInputProps = {
    accept: '.json,application/json',
    onChange: handleFileInputChange,
    inputRef: fileInputRef,
  };

  const dialogueDisplayProps = {
    allNPCs,
    heroShortName: heroSheet.heroShortName,
    history: dialogueState?.history ?? [],
    inventory,
    isDialogueExiting,
    isLoading,
    isVisible: !!dialogueState,
    mapData: mapData.nodes,
    onClose: handleForceExitDialogue,
    onOptionSelect: handleDialogueOptionSelectSafe,
    options: dialogueState?.options ?? [],
    participants: dialogueState?.participants ?? [],
  };

  const debugViewProps = {
    badFacts: debugBadFacts,
    debugLore,
    debugPacket: debugPacketStack[0],
    gameStateStack,
    goodFacts: debugGoodFacts,
    isVisible: isDebugViewVisible,
    onApplyGameState: handleApplyGameState,
    onClearFacts: handleClearFacts,
    onClose: closeDebugView,
    onDistillFacts: handleDistillClick,
    onSaveFacts: handleSaveFacts,
    onSimulateVictory: handleSimulateVictoryClick,
    onSpawnBook: handleSpawnBook,
    onSpawnMap: handleSpawnMap,
    onSpawnNpcAtLocation: handleSpawnNpcAtLocation,
    onSpawnPage: handleSpawnPage,
    onSpawnPicture: handleSpawnPicture,
    onSpawnVehicle: handleSpawnVehicle,
    onToggleDebugLore: toggleDebugLore,
    onTriggerMainQuestAchieved: handleTriggerMainQuestAchievedClick,
    onUndoTurn: handleUndoTurn,
    travelPath,
  };

  const titleMenuProps = {
    isGameActive: hasGameBeenInitialized,
    isVisible: effectiveIsTitleMenuOpen,
    onClose: closeTitleMenu,
    onLoadGame: handleLoadGameFromMenu,
    onNewGame: handleNewGameFromMenu,
    onOpenGeminiKeyModal: openGeminiKeyModal,
    onOpenInfo: openInfoFromMenu,
    onOpenSettings: openSettingsFromMenu,
    onSaveGame: hasGameBeenInitialized ? handleSaveGameFromMenu : undefined,
  };

  const gameSetupProps = {
    isVisible: isCustomGameSetupVisible,
    onClose: handleCloseCustomGameSetup,
    onThemeSelected: handleCustomThemeSelectedForNewGame,
  };

  const settingsDisplayProps = {
    enabledThemePacks,
    isVisible: isSettingsVisible,
    onChangePreferredPlayerName: handlePreferredPlayerNameChange,
    onChangeThinkingEffort: handleThinkingEffortChange,
    onClose: closeSettings,
    onToggleThemePack: handleToggleThemePackStable,
    preferredPlayerName,
    thinkingEffort,
  };

  const infoDisplayProps = {
    isVisible: isInfoVisible,
    onClose: closeInfo,
  };

  const debugLoreModalProps = {
    facts: debugLoreFacts,
    isVisible: isDebugLoreVisible,
    onClose: closeDebugLoreModal,
    onSubmit: submitDebugLoreModal,
  };

  const geminiKeyModalProps = {
    isVisible: geminiKeyVisible,
    onClose: closeGeminiKeyModal,
  };

  const genderSelectModalProps = {
    defaultGender: genderSelectDefault,
    isVisible: isGenderSelectVisible,
    onSubmit: submitGenderSelectModal,
  };

  const actIntroModalProps = pendingAct
    ? {
        act: pendingAct,
        isTurnGenerating: isActTurnGenerating,
        onContinue: handleActContinue,
      }
    : null;

  const victoryScreenProps = isVictory
    ? {
        heroSheet,
        onClose: handleVictoryClose,
        storyArc,
      }
    : null;

  const characterSelectModalProps = characterSelectData
    ? {
        WorldSheet: characterSelectData.WorldSheet,
        heroGender: characterSelectData.heroGender,
        isVisible: isCharacterSelectVisible,
        onComplete: submitCharacterSelectModal,
        onHeroData: submitCharacterSelectHeroData,
        options: characterSelectData.options,
        theme: characterSelectData.theme,
      }
    : null;

  const appModalsProps =
    hasGameBeenInitialized && !isPlaceholderTheme
      ? {
          adventureName: adventureNameForUi,
          allNPCs,
          canInspectJournal: canInspectPlayerJournal,
          canWriteJournal: canWritePlayerJournal,
          currentMapNodeId,
          currentQuest: mainQuest,
          currentScene,
          destinationNodeId,
          handleCancelLoadGameFromMenu,
          handleCancelNewGameFromMenu,
          handleConfirmLoadGameFromMenu: confirmLoadGameFromMenu,
          handleConfirmNewGameFromMenu: confirmNewGameFromMenu,
          inventory,
          isKnowledgeBaseVisible,
          isMapVisible,
          isPageVisible,
          isVisualizerVisible,
          isWritingJournal: isPlayerJournalWriting,
          itemPresenceByNode,
          lastJournalWriteTurn,
          loadGameFromMenuConfirmOpen,
          localEnvironment,
          localPlace,
          localTime,
          mapData,
          newGameFromMenuConfirmOpen,
          onCloseKnowledgeBase: closeKnowledgeBase,
          onCloseMap: closeMap,
          onClosePage: closePageView,
          onCloseVisualizer: closeVisualizer,
          onItemInspect: handleInspectFromPage,
          onLayoutConfigChange: handleMapLayoutConfigChange,
          onSelectDestination: handleSelectDestinationNode,
          onViewBoxChange: handleMapViewBoxChange,
          onWriteJournal: handleWritePlayerJournal,
          pageItemId,
          pageStartChapterIndex,
          playerJournal,
          setGeneratedImage: setGeneratedImageCache,
          storytellerThoughts: lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? '',
          theme,
          updateItemContent,
          updatePlayerJournalContent,
          visualizerImageScene,
          visualizerImageUrl,
        }
      : null;

  if (!appReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
        <LoadingSpinner />

        <p className="mt-4 text-xl text-sky-400">
          Initializing application...
        </p>
      </div>
    );
  }

  return (
    <>
      <AppLayout
        errorBanners={errorBanners}
        fileInputProps={fileInputProps}
        footerProps={footerProps}
        headerProps={{
          hasGameBeenInitialized,
          theme,
        }}
        isBlurred={isAnyModalOrDialogueActive}
        itemAnimatorProps={itemAnimatorProps}
      >
        <GameHud
          actionOptionsProps={actionOptionsProps}
          freeActionInputProps={freeActionInputProps}
          hasGameBeenInitialized={hasGameBeenInitialized}
          mainToolbarProps={mainToolbarProps}
          sceneDisplayProps={sceneDisplayProps}
          showInitialLoadingSpinner={showInitialLoadingSpinner}
          showSceneLoadingOverlay={showSceneLoadingOverlay}
          sidebarProps={sidebarProps}
        />
      </AppLayout>

      <AppModalManager
        actIntroModalProps={actIntroModalProps}
        appModalsProps={appModalsProps}
        characterSelectModalProps={characterSelectModalProps}
        currentMapNodeId={currentMapNodeId}
        debugLoreModalProps={debugLoreModalProps}
        debugViewProps={debugViewProps}
        dialogueDisplayProps={dialogueDisplayProps}
        gameSetupProps={gameSetupProps}
        geminiKeyModalProps={geminiKeyModalProps}
        genderSelectModalProps={genderSelectModalProps}
        infoDisplayProps={infoDisplayProps}
        mapData={mapData}
        mapLayoutConfig={mapLayoutConfig}
        mapViewBox={mapViewBox}
        onMapNodesPositioned={handleMapNodesPositionChange}
        settingsDisplayProps={settingsDisplayProps}
        shouldLockBodyScroll={isAnyModalOrDialogueActive}
        titleMenuProps={titleMenuProps}
        victoryScreenProps={victoryScreenProps}
      />
    </>
  );
}

export default AppContent;
