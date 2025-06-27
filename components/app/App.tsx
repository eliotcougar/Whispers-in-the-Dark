
/**
 * @file App.tsx
 * @description Main application component wiring together UI and game logic.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

import * as React from 'react';
import { useGameLogic } from '../../hooks/useGameLogic';
import SceneDisplay from '../SceneDisplay';
import ActionOptions from '../ActionOptions';
import GameSidebar from './GameSidebar';
import LoadingSpinner from '../LoadingSpinner';
import ErrorDisplay from '../ErrorDisplay';
import MainToolbar from '../MainToolbar';
import ModelUsageIndicators from '../ModelUsageIndicators';
import TitleMenu from '../modals/TitleMenu';
import DialogueDisplay from '../DialogueDisplay';
import DebugView from '../debug/DebugView';
import ItemChangeAnimator from '../inventory/ItemChangeAnimator';
import CustomGameSetupScreen from '../modals/CustomGameSetupScreen';
import SettingsDisplay from '../modals/SettingsDisplay';
import InfoDisplay from '../modals/InfoDisplay';
import DebugLoreModal from '../modals/DebugLoreModal';
import Footer from './Footer';
import AppModals from './AppModals';
import AppHeader from './AppHeader';
import FreeActionInput from './FreeActionInput';
import { formatKnownPlacesForPrompt, npcsToString } from '../../utils/promptFormatters';
import { generateJournalEntry } from '../../services/journal';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useAppModals } from '../../hooks/useAppModals';
import { useAutosave } from '../../hooks/useAutosave';
import { findTravelPath, buildTravelAdjacency, TravelStep, TravelAdjacency } from '../../utils/mapPathfinding';
import { isDescendantIdOf } from '../../utils/mapGraphUtils';
import { applyNestedCircleLayout } from '../../utils/mapLayoutUtils';


import {
  FREE_FORM_ACTION_COST,
  RECENT_LOG_COUNT_FOR_PROMPT,
  PLAYER_HOLDER_ID,
  PLAYER_JOURNAL_ID,
  INSPECT_COOLDOWN,
} from '../../constants';
import { ThemePackName, Item, ItemChapter, FullGameState } from '../../types';
import { saveDebugLoreToLocalStorage } from '../../services/storage';


function App() {
  const { clearProgress } = useLoadingProgress();
  const gameLogicRef = useRef<ReturnType<typeof useGameLogic> | null>(null);
  const getGameLogic = () => {
    if (!gameLogicRef.current) {
      throw new Error('Game logic is not initialized');
    }
    return gameLogicRef.current;
  };
  const {
    playerGender,
    setPlayerGender,
    enabledThemePacks,
    setEnabledThemePacks,
    stabilityLevel,
    setStabilityLevel,
    chaosLevel,
    setChaosLevel,
    initialSavedState,
    appReady,
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
    updateSettingsFromLoad,
  } = useSaveLoad({
    gatherGameStateStack: () => getGameLogic().gatherCurrentGameState(),
    applyLoadedGameState: (args) => getGameLogic().applyLoadedGameState(args),
    setError: (msg) => { getGameLogic().setError(msg); },
    setIsLoading: (val) => { getGameLogic().setIsLoading(val); },
    isLoading: gameLogicRef.current?.isLoading,
    dialogueState: gameLogicRef.current?.dialogueState,
    hasGameBeenInitialized: gameLogicRef.current?.hasGameBeenInitialized,
  });

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
    isHistoryVisible,
    isDebugViewVisible,
    isCustomGameSetupVisible,
    isManualShiftThemeSelectionVisible,
    shiftConfirmOpen,
    newGameFromMenuConfirmOpen,
    loadGameFromMenuConfirmOpen,
    newCustomGameConfirmOpen,
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
    openHistory,
    closeHistory,
    closeDebugView,
    setIsDebugViewVisible,
    openCustomGameSetup,
    closeCustomGameSetup,
    openManualShiftThemeSelection,
    closeManualShiftThemeSelection,
    openShiftConfirm,
    closeShiftConfirm,
    openNewGameFromMenuConfirm,
    closeNewGameFromMenuConfirm,
    openLoadGameFromMenuConfirm,
    closeLoadGameFromMenuConfirm,
    openNewCustomGameConfirm,
    closeNewCustomGameConfirm,
    pageItemId,
    pageStartChapterIndex,
    isPageVisible,
    openPageView,
    closePageView,
    isDebugLoreVisible,
    debugLoreFacts,
    openDebugLoreModal,
    submitDebugLoreModal,
    closeDebugLoreModal,
  } = useAppModals();


  const gameLogic = useGameLogic({
    playerGenderProp: playerGender,
    enabledThemePacksProp: enabledThemePacks,
    stabilityLevelProp: stabilityLevel,
    chaosLevelProp: chaosLevel,
    onSettingsUpdateFromLoad: updateSettingsFromLoad,
    initialSavedStateFromApp: initialSavedState,
    isAppReady: appReady,
    openDebugLoreModal,
  });
  gameLogicRef.current = gameLogic;

  const {
    currentTheme,
    currentScene, mainQuest, currentObjective, actionOptions,
    inventory, itemsHere, itemPresenceByNode, gameLog, isLoading, error, lastActionLog, themeHistory, mapData,
    currentMapNodeId, mapLayoutConfig,
    allNPCs,
    score, freeFormActionText, setFreeFormActionText,
    handleFreeFormActionSubmit, objectiveAnimationType, handleActionSelect,
    handleItemInteraction, handleTakeLocationItem, handleRetry, executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection,
    isAwaitingManualShiftThemeSelection,
    startCustomGame,
    gatherCurrentGameState: gatherGameStateStack, hasGameBeenInitialized, handleStartNewGameFromButton,
    localTime, localEnvironment, localPlace,
    dialogueState,
    handleDialogueOptionSelect,
    handleForceExitDialogue,
    isDialogueExiting,
    lastDebugPacket,
    lastTurnChanges,
    turnsSinceLastShift,
    globalTurnNumber,
    isCustomGameMode,
    gameStateStack,
    handleMapLayoutConfigChange,
    loadingReason,
    handleUndoTurn,
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
    debugLore,
    debugGoodFacts,
    debugBadFacts,
  } = gameLogic;


  const handleApplyGameState = useCallback(
    (state: FullGameState) => { commitGameState(state); },
    [commitGameState]
  );

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
    gameLogic.clearDebugFacts();
    saveDebugLoreToLocalStorage({
      debugLore: gameLogic.debugLore,
      debugGoodFacts: [],
      debugBadFacts: [],
    });
  }, [gameLogic]);

  useEffect(() => {
    if (!isLoading) {
      clearProgress();
    }
  }, [isLoading, clearProgress]);

  const prevGameLogLength = useRef(gameLog.length);
  const prevSceneRef = useRef(currentScene);


  const effectiveIsTitleMenuOpen = userRequestedTitleMenuOpen || (appReady && !hasGameBeenInitialized && !isLoading && !isCustomGameSetupVisible && !isManualShiftThemeSelectionVisible);

  const isAnyModalOrDialogueActive =
    isVisualizerVisible ||
    isKnowledgeBaseVisible ||
    isSettingsVisible ||
    isInfoVisible ||
    isMapVisible ||
    isHistoryVisible ||
    isDebugViewVisible ||
    isPageVisible ||
    isDebugLoreVisible ||
    !!dialogueState ||
    effectiveIsTitleMenuOpen ||
    shiftConfirmOpen ||
    newGameFromMenuConfirmOpen ||
    loadGameFromMenuConfirmOpen ||
    isCustomGameSetupVisible ||
    newCustomGameConfirmOpen ||
    isManualShiftThemeSelectionVisible;


  useEffect(() => {
    const body = document.body;
    if (isAnyModalOrDialogueActive) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollBarWidth > 0) {
        body.style.paddingRight = `${String(scrollBarWidth)}px`;
      }
    } else {
      body.style.overflow = '';
      body.style.paddingRight = '';
    }
    return () => {
      body.style.overflow = '';
      body.style.paddingRight = '';
    };
  }, [isAnyModalOrDialogueActive]);

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
    gatherGameStateStack,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    setError: (msg) => { getGameLogic().setError(msg); },
    dependencies: [
      currentTheme, currentScene, actionOptions, mainQuest, currentObjective,
      inventory, gameLog, lastActionLog, themeHistory, mapData, currentMapNodeId,
      mapLayoutConfig, allNPCs, score, localTime, localEnvironment, localPlace,
      playerGender, enabledThemePacks, stabilityLevel, chaosLevel, turnsSinceLastShift,
      isCustomGameMode, isAwaitingManualShiftThemeSelection,
      debugLore, debugGoodFacts, debugBadFacts,
    ],
  });




  const canPerformFreeAction = score >= FREE_FORM_ACTION_COST && !isLoading && hasGameBeenInitialized && !dialogueState;


  const enableMobileTap =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none)').matches;

  const setGeneratedImageCache = useCallback((url: string, scene: string) => {
    setVisualizerImageUrl(url);
    setVisualizerImageScene(scene);
  }, [setVisualizerImageUrl, setVisualizerImageScene]);

  const confirmShift = useCallback(() => {
    executeManualRealityShift();
    closeShiftConfirm();
  }, [executeManualRealityShift, closeShiftConfirm]);

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
    lastJournalWriteTurn !== globalTurnNumber && !isPlayerJournalWriting;
  const canInspectPlayerJournal =
    playerJournal.length > 0 &&
    (lastJournalInspectTurn === 0 ||
      globalTurnNumber - lastJournalInspectTurn >= INSPECT_COOLDOWN);

  const handleReadPlayerJournal = useCallback(() => {
    const index = playerJournal.length > 0 ? playerJournal.length - 1 : 0;
    openPageView(PLAYER_JOURNAL_ID, index);
  }, [openPageView, playerJournal.length]);

  const handleWritePlayerJournal = useCallback(() => {
    if (lastJournalWriteTurn === globalTurnNumber || isPlayerJournalWriting) return;
    setIsPlayerJournalWriting(true);
    openPageView(PLAYER_JOURNAL_ID, playerJournal.length);
    void (async () => {
      if (!currentTheme) { setIsPlayerJournalWriting(false); return; }
      const { name: themeName, systemInstructionModifier } = currentTheme;
      const nodes = mapData.nodes.filter(
        node => node.themeName === themeName && node.data.nodeType !== 'feature' && node.data.nodeType !== 'room'
      );
      const knownPlaces = formatKnownPlacesForPrompt(nodes, true);
      const npcs = allNPCs.filter(npc => npc.themeName === themeName);
      const knownNPCs = npcs.length > 0
        ? npcsToString(npcs, ' - ', false, false, false, true)
        : 'None specifically known in this theme yet.';
      const prev = playerJournal[playerJournal.length - 1]?.actualContent ?? '';
      const entryLength = Math.floor(Math.random() * 50) + 100;
      const entry = await generateJournalEntry(
        entryLength,
        'Personal Journal',
        'Your own journal',
        prev,
        themeName,
        systemInstructionModifier,
        currentScene,
        lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? '',
        knownPlaces,
        knownNPCs,
        gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT),
        mainQuest
      );
      if (entry) {
        const chapter = {
          heading: entry.heading,
          description: '',
          contentLength: entryLength,
          actualContent: entry.text,
        } as ItemChapter;
        addPlayerJournalEntry(chapter);
        openPageView(PLAYER_JOURNAL_ID, playerJournal.length);
      }
      setIsPlayerJournalWriting(false);
    })();
  }, [
    allNPCs,
    currentTheme,
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
          tags: [currentTheme?.playerJournalStyle ?? 'handwritten'],
        };
        const updatedState = recordPlayerJournalInspect();
        handleItemInteraction(pseudoItem, 'inspect', undefined, updatedState);
        return;
      }

      const item = inventory.find(it => it.id === itemId);
      if (item) {
        handleItemInteraction(item, 'inspect');
      }
    },
    [
      inventory,
      handleItemInteraction,
      playerJournal,
      lastJournalWriteTurn,
      recordPlayerJournalInspect,
      currentTheme,
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

  const handleCancelShift = useCallback(
    () => { closeShiftConfirm(); },
    [closeShiftConfirm]
  );

  const handleCancelNewCustomGame = useCallback(() => {
    closeNewCustomGameConfirm();
    openTitleMenu();
  }, [closeNewCustomGameConfirm, openTitleMenu]);

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
          getGameLogic().setError('At least one theme pack must be enabled.');
          return prevPacks;
        }
        return newPacks;
      });
    },
    [setEnabledThemePacks]
  );

  useEffect(() => {
    if (isAwaitingManualShiftThemeSelection && !isManualShiftThemeSelectionVisible) {
      openManualShiftThemeSelection();
    }
  }, [isAwaitingManualShiftThemeSelection, isManualShiftThemeSelectionVisible, openManualShiftThemeSelection]);

  const handleManualShiftThemeSelected = useCallback(
    (themeName: string) => {
      closeManualShiftThemeSelection();
      completeManualShiftWithSelectedTheme(themeName);
    },
    [closeManualShiftThemeSelection, completeManualShiftWithSelectedTheme]
  );

  const handleCancelManualShiftThemeSelection = useCallback(() => {
    closeManualShiftThemeSelection();
    cancelManualShiftThemeSelection();
  }, [closeManualShiftThemeSelection, cancelManualShiftThemeSelection]);

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
      handleStartNewGameFromButton();
    }
  }, [closeTitleMenu, hasGameBeenInitialized, handleStartNewGameFromButton, openNewGameFromMenuConfirm]);

  const confirmNewGameFromMenu = useCallback(() => {
    closeNewGameFromMenuConfirm();
    handleStartNewGameFromButton();
  }, [closeNewGameFromMenuConfirm, handleStartNewGameFromButton]);

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

  const handleSaveGameFromMenu = useCallback(() => {
    closeTitleMenu();
    handleSaveToFile();
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


  const handleOpenCustomGameSetup = useCallback(() => {
    closeTitleMenu();
    if (hasGameBeenInitialized) {
      openNewCustomGameConfirm();
    } else {
      openCustomGameSetup();
    }
  }, [closeTitleMenu, hasGameBeenInitialized, openCustomGameSetup, openNewCustomGameConfirm]);

  const confirmNewCustomGame = useCallback(() => {
    closeNewCustomGameConfirm();
    openCustomGameSetup();
  }, [closeNewCustomGameConfirm, openCustomGameSetup]);

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

  const [mapInitialViewBox, setMapInitialViewBox] = useState(mapViewBox);
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
  const prevMapVisibleRef = useRef(false);
  useEffect(() => {
    if (isMapVisible && !prevMapVisibleRef.current) {
      const layoutNodes = applyNestedCircleLayout(
        mapData.nodes.filter(n => n.themeName === currentTheme?.name).map(n => ({ ...n })),
          {
            padding: mapLayoutConfig.NESTED_PADDING,
            anglePadding: mapLayoutConfig.NESTED_ANGLE_PADDING,
          }
      );
      handleMapNodesPositionChange(layoutNodes);

      const parts = mapViewBox.split(' ').map(parseFloat);
      if (parts.length === 4) {
        const [, , vw, vh] = parts;
        const node = layoutNodes.find(n => n.id === currentMapNodeId);
        if (node && !isNaN(vw) && !isNaN(vh)) {
          setMapInitialViewBox(
            `${String(node.position.x - vw / 2)} ${String(node.position.y - vh / 2)} ${String(vw)} ${String(vh)}`
          );
        } else {
          setMapInitialViewBox(mapViewBox);
        }
      } else {
        setMapInitialViewBox(mapViewBox);
      }
    }
    if (!isMapVisible) prevMapVisibleRef.current = false;
    else prevMapVisibleRef.current = true;
  }, [
    isMapVisible,
    mapViewBox,
    currentMapNodeId,
    mapData.nodes,
    currentTheme?.name,
    mapLayoutConfig,
    handleMapNodesPositionChange,
  ]);


  if (!appReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
        <LoadingSpinner loadingReason="initial_load" />

        <p className="mt-4 text-xl text-sky-400">
          Initializing application...
        </p>
      </div>
    );
  }


  return (
    <>
      <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 flex flex-col items-center">
        <AppHeader
          currentTheme={currentTheme}
          hasGameBeenInitialized={hasGameBeenInitialized}
          isCustomGameMode={isCustomGameMode}
        />

        {error && !isLoading && !dialogueState && hasGameBeenInitialized ? <div className="w-full max-w-3xl my-4">
          <ErrorDisplay
            message={error}
            onRetry={handleRetryClick}
          />
        </div> : null}

        {error && !hasGameBeenInitialized ? <div className="w-full max-w-3xl my-4">
          <ErrorDisplay
            message={error}
            onRetry={handleRetryClick}
          />
        </div> : null}

        <main className={`w-full max-w-screen-xl grid grid-cols-1 lg:grid-cols-4 gap-3 flex-grow ${(isAnyModalOrDialogueActive) ? 'filter blur-sm pointer-events-none' : ''}`}>
          <div className="lg:col-span-2 space-y-3 flex flex-col">
            <MainToolbar
              currentSceneExists={!!currentScene}
              currentThemeName={currentTheme ? currentTheme.name : null}
              isLoading={isLoading || !!dialogueState}
              onManualRealityShift={openShiftConfirm}
              onOpenHistory={openHistory}
              onOpenKnowledgeBase={openKnowledgeBase}
              onOpenMap={openMap}
              onOpenTitleMenu={openTitleMenu}
              onOpenVisualizer={openVisualizer}
              score={score}
              turnsSinceLastShift={turnsSinceLastShift}
            />
              
            <ModelUsageIndicators />

            {isLoading && !hasGameBeenInitialized ? !error && <LoadingSpinner loadingReason={loadingReason} /> : null}

            {!hasGameBeenInitialized ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg flex-grow min-h-48" />
              ) : (
                <>
                  <div className="relative">
                    <SceneDisplay
                      allNPCs={allNPCs}
                      currentThemeName={currentTheme ? currentTheme.name : null}
                      description={currentScene}
                      inventory={inventory}
                      lastActionLog={lastActionLog}
                      localEnvironment={localEnvironment}
                      localPlace={localPlace}
                      localTime={localTime}
                      mapData={mapData.nodes}
                    />

                    {isLoading && !dialogueState && !isDialogueExiting && Boolean(hasGameBeenInitialized) ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 rounded-lg">
                        <LoadingSpinner loadingReason={loadingReason} />
                      </div>
                    ) : null}
                  </div>

                  <ActionOptions
                    allNPCs={allNPCs}
                    currentThemeName={currentTheme ? currentTheme.name : null}
                    disabled={isLoading || !!dialogueState}
                    inventory={inventory}
                    mapData={mapData.nodes}
                    onActionSelect={handleActionSelect}
                    options={actionOptions}
                  />

                  <FreeActionInput
                    canPerformFreeAction={canPerformFreeAction}
                    freeFormActionText={freeFormActionText}
                    onChange={handleFreeFormActionChange}
                    onSubmit={handleFreeFormActionSubmit}
                  />
                </>)}
          </div>

          <div className="lg:col-span-2 space-y-2 flex flex-col">
            {!hasGameBeenInitialized ? (
              <div className="hidden lg:block bg-slate-800/50 border border-slate-700 rounded-lg flex-grow min-h-48" />
            ) : (
              <GameSidebar
                allNPCs={allNPCs}
                currentMapNodeId={currentMapNodeId}
                currentObjective={currentObjective}
                currentThemeName={currentTheme ? currentTheme.name : null}
                disabled={isLoading || isAnyModalOrDialogueActive}
                enableMobileTap={enableMobileTap}
                globalTurnNumber={globalTurnNumber}
                inventory={inventory}
                itemsHere={itemsHere}
                mainQuest={mainQuest}
                mapNodes={mapData.nodes}
                objectiveAnimationType={objectiveAnimationType}
                onDropItem={gameLogic.handleDropItem}
                onItemInteract={handleItemInteraction}
                onReadPage={handleReadPage}
                onReadPlayerJournal={handleReadPlayerJournal}
                onStashToggle={gameLogic.handleStashToggle}
                onTakeItem={handleTakeLocationItem}
              />
            )}
          </div>
        </main>

        <ItemChangeAnimator
          isGameBusy={isAnyModalOrDialogueActive || isLoading}
          lastTurnChanges={lastTurnChanges}
        />

        <Footer
          isBlurred={isAnyModalOrDialogueActive}
          isDebugViewVisible={isDebugViewVisible}
          setIsDebugViewVisible={setIsDebugViewVisible}
        />
      </div>

      <input
        accept=".json,application/json"
        aria-hidden="true"
        className="hidden"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file"
      />

      <DialogueDisplay
        allNPCs={allNPCs}
        currentThemeName={currentTheme ? currentTheme.name : null}
        history={dialogueState?.history ?? []}
        inventory={inventory}
        isDialogueExiting={isDialogueExiting}
        isLoading={isLoading}
        isVisible={!!dialogueState}
        loadingReason={loadingReason}
        mapData={mapData.nodes}
        onClose={handleForceExitDialogue}
        onOptionSelect={handleDialogueOptionSelectSafe}
        options={dialogueState?.options ?? []}
        participants={dialogueState?.participants ?? []}
      />

      <DebugView
        badFacts={debugBadFacts}
        debugLore={debugLore}
        debugPacket={lastDebugPacket}
        gameStateStack={gameStateStack}
        goodFacts={debugGoodFacts}
        isVisible={isDebugViewVisible}
        onApplyGameState={handleApplyGameState}
        onClearFacts={handleClearFacts}
        onClose={closeDebugView}
        onDistillFacts={handleDistillClick}
        onSaveFacts={handleSaveFacts}
        onToggleDebugLore={toggleDebugLore}
        onUndoTurn={handleUndoTurn}
        travelPath={travelPath}
      />

      <TitleMenu
        isGameActive={hasGameBeenInitialized}
        isVisible={effectiveIsTitleMenuOpen}
        onClose={closeTitleMenu}
        onCustomGame={handleOpenCustomGameSetup}
        onLoadGame={handleLoadGameFromMenu}
        onNewGame={handleNewGameFromMenu}
        onOpenInfo={openInfoFromMenu}
        onOpenSettings={openSettingsFromMenu}
        onSaveGame={hasGameBeenInitialized ? handleSaveGameFromMenu : undefined}
      />

      <CustomGameSetupScreen
        isVisible={isCustomGameSetupVisible}
        onClose={handleCloseCustomGameSetup}
        onThemeSelected={handleCustomThemeSelectedForNewGame}
      />

      <CustomGameSetupScreen
        descriptionText="Choose the theme you wish to manually shift your reality to. The current theme is disabled."
        disabledThemeName={currentTheme ? currentTheme.name : null}
        isVisible={isManualShiftThemeSelectionVisible}
        onClose={handleCancelManualShiftThemeSelection}
        onThemeSelected={handleManualShiftThemeSelected}
        titleText="Select Destination Theme"
      />

      <SettingsDisplay
        chaosLevel={chaosLevel}
        enabledThemePacks={enabledThemePacks}
        isCustomGameMode={isCustomGameMode}
        isVisible={isSettingsVisible}
        onChaosChange={setChaosLevel}
        onClose={closeSettings}
        onPlayerGenderChange={setPlayerGender}
        onStabilityChange={setStabilityLevel}
        onToggleThemePack={handleToggleThemePackStable}
        playerGender={playerGender}
        stabilityLevel={stabilityLevel}
      />

      <InfoDisplay
        isVisible={isInfoVisible}
        onClose={closeInfo}
      />

      <DebugLoreModal
        facts={debugLoreFacts}
        isVisible={isDebugLoreVisible}
        onClose={closeDebugLoreModal}
        onSubmit={submitDebugLoreModal}
      />

      {hasGameBeenInitialized && currentTheme ? <AppModals
        allNPCs={allNPCs}
        canInspectJournal={canInspectPlayerJournal}
        canWriteJournal={canWritePlayerJournal}
        currentMapNodeId={currentMapNodeId}
        currentQuest={mainQuest}
        currentScene={currentScene}
        currentTheme={currentTheme}
        currentThemeName={currentTheme.name}
        destinationNodeId={destinationNodeId}
        gameLog={gameLog}
        handleCancelLoadGameFromMenu={handleCancelLoadGameFromMenu}
        handleCancelNewCustomGame={handleCancelNewCustomGame}
        handleCancelNewGameFromMenu={handleCancelNewGameFromMenu}
        handleCancelShift={handleCancelShift}
        handleConfirmLoadGameFromMenu={confirmLoadGameFromMenu}
        handleConfirmNewCustomGame={confirmNewCustomGame}
        handleConfirmNewGameFromMenu={confirmNewGameFromMenu}
        handleConfirmShift={confirmShift}
        initialLayoutConfig={mapLayoutConfig}
        initialViewBox={mapInitialViewBox}
        inventory={inventory}
        isCustomGameModeShift={isCustomGameMode}
        isHistoryVisible={isHistoryVisible}
        isKnowledgeBaseVisible={isKnowledgeBaseVisible}
        isMapVisible={isMapVisible}
        isPageVisible={isPageVisible}
        isVisualizerVisible={isVisualizerVisible}
        isWritingJournal={isPlayerJournalWriting}
        itemPresenceByNode={itemPresenceByNode}
        lastJournalWriteTurn={lastJournalWriteTurn}
        loadGameFromMenuConfirmOpen={loadGameFromMenuConfirmOpen}
        localEnvironment={localEnvironment}
        localPlace={localPlace}
        localTime={localTime}
        mapData={mapData}
        newCustomGameConfirmOpen={newCustomGameConfirmOpen}
        newGameFromMenuConfirmOpen={newGameFromMenuConfirmOpen}
        onCloseHistory={closeHistory}
        onCloseKnowledgeBase={closeKnowledgeBase}
        onCloseMap={closeMap}
        onClosePage={closePageView}
        onCloseVisualizer={closeVisualizer}
        onItemInspect={handleInspectFromPage}
        onLayoutConfigChange={handleMapLayoutConfigChange}
        onNodesPositioned={handleMapNodesPositionChange}
        onSelectDestination={handleSelectDestinationNode}
        onViewBoxChange={handleMapViewBoxChange}
        onWriteJournal={handleWritePlayerJournal}
        pageItemId={pageItemId}
        pageStartChapterIndex={pageStartChapterIndex}
        playerJournal={playerJournal}
        setGeneratedImage={setGeneratedImageCache}
        shiftConfirmOpen={shiftConfirmOpen}
        storytellerThoughts={lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? ''}
        themeHistory={themeHistory}
        updateItemContent={updateItemContent}
        updatePlayerJournalContent={updatePlayerJournalContent}
        visualizerImageScene={visualizerImageScene}
        visualizerImageUrl={visualizerImageUrl}
      /> : null}
    </>
  );
}

export default App;
