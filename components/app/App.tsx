
/**
 * @file App.tsx
 * @description Main application component wiring together UI and game logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

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
import GeminiKeyModal from '../modals/GeminiKeyModal';
import CharacterSelectModal from '../modals/CharacterSelectModal';
import GenderSelectModal from '../modals/GenderSelectModal';
import ActIntroModal from '../modals/ActIntroModal';
import VictoryScreen from '../modals/VictoryScreen';
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
import { isApiConfigured } from '../../services/apiClient';


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
  AdventureTheme,
  WorldFacts,
  CharacterOption,
  HeroSheet,
  HeroBackstory,
  StoryAct,
  StoryArc,
  ThinkingEffort,
} from '../../types';
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
    enabledThemePacks,
    setEnabledThemePacks,
    thinkingEffort,
    setThinkingEffort,
    preferredPlayerName,
    setPreferredPlayerName,
    initialSavedState,
    initialDebugStack,
    appReady,
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
  } = useSaveLoad({
    gatherGameStateStack: () => getGameLogic().gatherCurrentGameState(),
    gatherDebugPacketStack: () => getGameLogic().gatherDebugPacketStack(),
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
    openDebugLoreModal,
    isGenderSelectVisible,
    openGenderSelectModal,
    submitGenderSelectModal,
    openCharacterSelectModal,
    isCharacterSelectVisible,
    characterSelectData,
    submitCharacterSelectModal,
    submitCharacterSelectHeroData,
    genderSelectDefault,
    submitDebugLoreModal,
    closeDebugLoreModal,
  } = useAppModals();

  const [geminiKeyVisible, setGeminiKeyVisible] = useState<boolean>(false);

  const [pendingAct, setPendingAct] = useState<StoryAct | null>(null);

  useEffect(() => {
    if (!isApiConfigured()) {
      setGeminiKeyVisible(true);
    }
  }, []);

  const openGeminiKeyModal = useCallback(() => { setGeminiKeyVisible(true); }, []);
  const closeGeminiKeyModal = useCallback(() => { setGeminiKeyVisible(false); }, []);

  const openCharacterSelect = useCallback(
    (
      data: {
        theme: AdventureTheme;
        heroGender: string;
        worldFacts: WorldFacts;
        options: Array<CharacterOption>;
      },
      onHeroData: (result: {
        name: string;
        heroSheet: HeroSheet | null;
        heroBackstory: HeroBackstory | null;
        storyArc: StoryArc | null;
      }) => Promise<void>,
    ) =>
      new Promise<void>(resolve => {
        openCharacterSelectModal(data, onHeroData, resolve);
      }),
    [openCharacterSelectModal],
  );

  const openGenderSelect = useCallback(
    (defaultGender: string) =>
      new Promise<string>(resolve => {
        openGenderSelectModal(defaultGender, resolve);
      }),
    [openGenderSelectModal],
  );


  const gameLogic = useGameLogic({
    enabledThemePacksProp: enabledThemePacks,
    thinkingEffortProp: thinkingEffort,
    preferredPlayerNameProp: preferredPlayerName,
    initialSavedStateFromApp: initialSavedState,
    initialDebugStackFromApp: initialDebugStack,
    isAppReady: appReady,
    openDebugLoreModal,
    openCharacterSelectModal: openCharacterSelect,
    openGenderSelectModal: openGenderSelect,
    onActIntro: setPendingAct,
  });
  gameLogicRef.current = gameLogic;

  const handleThinkingEffortChange = useCallback(
    (value: ThinkingEffort) => {
      setThinkingEffort(value);
      const current = getGameLogic().gatherCurrentGameState()[0];
      getGameLogic().commitGameState({ ...current, thinkingEffort: value });
    },
    [setThinkingEffort],
  );

  const handlePreferredPlayerNameChange = useCallback((value: string) => {
    setPreferredPlayerName(value);
  }, [setPreferredPlayerName]);

  const {
    currentTheme,
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
    debugLore,
    debugGoodFacts,
      debugBadFacts,
      isVictory,
      simulateVictory,
      queueItemAction,
      queuedItemActions,
    clearQueuedItemActions,
    remainingActionPoints,
  } = gameLogic;

  const isActTurnGenerating = pendingAct !== null && (isLoading || isTurnProcessing);


  useEffect(() => {
    if (isVictory) {
      setPendingAct(null);
    }
  }, [isVictory]);

  useEffect(() => {
    if (lastTurnChanges?.mainQuestAchieved) {
      void triggerMainQuestAchieved();
    }
  }, [lastTurnChanges?.mainQuestAchieved, triggerMainQuestAchieved]);

  const handleActContinue = useCallback(() => {
    setPendingAct(null);
  }, []);


  const handleApplyGameState = useCallback(
    (state: FullGameState) => { commitGameState(state); },
    [commitGameState]
  );

  const handleTriggerMainQuestAchievedClick = useCallback(() => {
    void triggerMainQuestAchieved();
  }, [triggerMainQuestAchieved]);

  const handleSimulateVictoryClick = useCallback(() => {
    void simulateVictory();
  }, [simulateVictory]);

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


  const effectiveIsTitleMenuOpen = userRequestedTitleMenuOpen || (appReady && !hasGameBeenInitialized && !isLoading && !isCustomGameSetupVisible);

  // Modal visibility (non-blocking and blocking classification)
  const isVictoryModalVisible = Boolean(gameLogic.isVictory && gameLogic.heroSheet && gameLogic.storyArc);
  const isAnyModalActive =
    isVisualizerVisible ||
    isKnowledgeBaseVisible ||
    isSettingsVisible ||
    isInfoVisible ||
    isMapVisible ||
    isDebugViewVisible ||
    isPageVisible ||
    isDebugLoreVisible ||
    effectiveIsTitleMenuOpen ||
    newGameFromMenuConfirmOpen ||
    loadGameFromMenuConfirmOpen ||
    isCustomGameSetupVisible ||
    geminiKeyVisible ||
    isGenderSelectVisible ||
    isCharacterSelectVisible ||
    isVictoryModalVisible ||
    pendingAct !== null;

  // Blocking modals stop background turn generation
  const isAnyBlockingModalActive =
    effectiveIsTitleMenuOpen ||
    newGameFromMenuConfirmOpen ||
    loadGameFromMenuConfirmOpen ||
    isCustomGameSetupVisible ||
    geminiKeyVisible ||
    isGenderSelectVisible ||
    isCharacterSelectVisible ||
    isVictoryModalVisible ||
    isDebugLoreVisible; // requires user confirmation

  // For UI blur we also blur during dialogue
  const isAnyModalOrDialogueActive = isAnyModalActive || !!dialogueState;


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
    appReady,
    dependencies: [
      currentTheme,
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
    setError: (msg) => { getGameLogic().setError(msg); },
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
      if (!currentTheme) { setIsPlayerJournalWriting(false); return; }
      const { name: themeName, storyGuidance } = currentTheme;
      const nodes = mapData.nodes.filter(
        node => node.data.nodeType !== 'feature' && node.data.nodeType !== 'room'
      );
      const knownPlaces = formatKnownPlacesForPrompt(nodes, true);
      const knownNPCs = allNPCs.length > 0
        ? npcsToString(allNPCs, ' - ', false, false, false, true)
        : 'None specifically known in this theme yet.';
      const prev = playerJournal[playerJournal.length - 1]?.actualContent ?? '';
      const entryLength = Math.floor(Math.random() * 50) + 100;
      const journalResult = await generateJournalEntry( /* TODO: Somewhere around here we need to sanitize Chapter heading to remove any HTML or Markup formatting */
        entryLength,
        'Personal Journal',
        'Your own journal',
        prev,
        themeName,
        storyGuidance,
        currentScene,
        lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? '',
        knownPlaces,
        knownNPCs,
        gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT),
        mainQuest
      );
      if (journalResult?.entry) {
        const chapter = {
          heading: journalResult.entry.heading,
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
        mapData.nodes.map(n => ({ ...n })),
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
        <LoadingSpinner />

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
              isLoading={isLoading || !!dialogueState || isTurnProcessing}
              isTurnProcessing={isTurnProcessing}
              onOpenKnowledgeBase={openKnowledgeBase}
              onOpenMap={openMap}
              onOpenTitleMenu={openTitleMenu}
              onOpenVisualizer={openVisualizer}
              score={score}
            />
              
            <ModelUsageIndicators />

            {isLoading && !hasGameBeenInitialized ? !error && <LoadingSpinner /> : null}

            {!hasGameBeenInitialized ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg flex-grow min-h-48" />
              ) : (
                <>
                  <div className="relative">
                    <SceneDisplay
                      allNPCs={allNPCs}
                      description={currentScene}
                      inventory={inventory}
                      lastActionLog={lastActionLog}
                      localEnvironment={localEnvironment}
                      localPlace={localPlace}
                      localTime={localTime}
                      mapData={mapData.nodes}
                    />

                    {isLoading && !dialogueState && !isDialogueExiting ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 rounded-lg">
                        <LoadingSpinner />
                      </div>
                    ) : null}
                  </div>

                  <ActionOptions
                    allNPCs={allNPCs}
                    disabled={isLoading || isTurnProcessing || !!dialogueState}
                    inventory={inventory}
                    mapData={mapData.nodes}
                    onActionSelect={handleActionSelect}
                    onClearQueuedActions={clearQueuedItemActions}
                    options={actionOptions}
                    queuedActions={queuedItemActions}
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
                disabled={isLoading || isTurnProcessing || isAnyModalOrDialogueActive}
                enableMobileTap={enableMobileTap}
                globalTurnNumber={globalTurnNumber}
                inventory={inventory}
                itemsHere={itemsHere}
                mapNodes={mapData.nodes}
                objectiveAnimationType={objectiveAnimationType}
                onItemInteract={queueItemAction}
                onReadPage={handleReadPage}
                onReadPlayerJournal={handleReadPlayerJournal}
                onStashToggle={gameLogic.handleStashToggle}
                queuedActionIds={new Set(queuedItemActions.map(a => a.id))}
                remainingActionPoints={remainingActionPoints}
                storyArc={storyArc}
              />
              )}
          </div>
        </main>

        <ItemChangeAnimator
          // Pause animations during turn processing or while ANY modal is active
          currentTurnNumber={globalTurnNumber}
          isGameBusy={isLoading || isTurnProcessing || isAnyModalActive}
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
        heroShortName={heroSheet?.heroShortName}
        history={dialogueState?.history ?? []}
        inventory={inventory}
        isDialogueExiting={isDialogueExiting}
        isLoading={isLoading}
        isVisible={!!dialogueState}
        mapData={mapData.nodes}
        onClose={handleForceExitDialogue}
        onOptionSelect={handleDialogueOptionSelectSafe}
        options={dialogueState?.options ?? []}
        participants={dialogueState?.participants ?? []}
      />

      <DebugView
        badFacts={debugBadFacts}
        debugLore={debugLore}
        debugPacket={debugPacketStack[0]}
        gameStateStack={gameStateStack}
        goodFacts={debugGoodFacts}
        isVisible={isDebugViewVisible}
        onApplyGameState={handleApplyGameState}
        onClearFacts={handleClearFacts}
        onClose={closeDebugView}
        onDistillFacts={handleDistillClick}
        onSaveFacts={handleSaveFacts}
        onSimulateVictory={handleSimulateVictoryClick}
        onToggleDebugLore={toggleDebugLore}
        onTriggerMainQuestAchieved={handleTriggerMainQuestAchievedClick}
        onUndoTurn={handleUndoTurn}
        travelPath={travelPath}
      />

      <TitleMenu
        isGameActive={hasGameBeenInitialized}
        isVisible={effectiveIsTitleMenuOpen}
        onClose={closeTitleMenu}
        onLoadGame={handleLoadGameFromMenu}
        onNewGame={handleNewGameFromMenu}
        onOpenGeminiKeyModal={openGeminiKeyModal}
        onOpenInfo={openInfoFromMenu}
        onOpenSettings={openSettingsFromMenu}
        onSaveGame={hasGameBeenInitialized ? handleSaveGameFromMenu : undefined}
      />

      <CustomGameSetupScreen
        isVisible={isCustomGameSetupVisible}
        onClose={handleCloseCustomGameSetup}
        onThemeSelected={handleCustomThemeSelectedForNewGame}
      />


      <SettingsDisplay
        enabledThemePacks={enabledThemePacks}
        isVisible={isSettingsVisible}
        onChangePreferredPlayerName={handlePreferredPlayerNameChange}
        onChangeThinkingEffort={handleThinkingEffortChange}
        onClose={closeSettings}
        onToggleThemePack={handleToggleThemePackStable}
        preferredPlayerName={preferredPlayerName}
        thinkingEffort={thinkingEffort}
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

      <GeminiKeyModal
        isVisible={geminiKeyVisible}
        onClose={closeGeminiKeyModal}
      />

      <GenderSelectModal
        defaultGender={genderSelectDefault}
        isVisible={isGenderSelectVisible}
        onSubmit={submitGenderSelectModal}
      />

      {pendingAct ? (
        <ActIntroModal
          act={pendingAct}
          isTurnGenerating={isActTurnGenerating}
          onContinue={handleActContinue}
        />
      ) : null}

      {isVictory && heroSheet && storyArc ? (
        <VictoryScreen
          heroSheet={heroSheet}
          onClose={handleVictoryClose}
          storyArc={storyArc}
        />
      ) : null}

      {characterSelectData ? (
        <CharacterSelectModal
          heroGender={characterSelectData.heroGender}
          isVisible={isCharacterSelectVisible}
          onComplete={submitCharacterSelectModal}
          onHeroData={submitCharacterSelectHeroData}
          options={characterSelectData.options}
          theme={characterSelectData.theme}
          worldFacts={characterSelectData.worldFacts}
        />
      ) : null}

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
        handleCancelLoadGameFromMenu={handleCancelLoadGameFromMenu}
        handleCancelNewGameFromMenu={handleCancelNewGameFromMenu}
        handleConfirmLoadGameFromMenu={confirmLoadGameFromMenu}
        handleConfirmNewGameFromMenu={confirmNewGameFromMenu}
        initialLayoutConfig={mapLayoutConfig}
        initialViewBox={mapInitialViewBox}
        inventory={inventory}
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
        newGameFromMenuConfirmOpen={newGameFromMenuConfirmOpen}
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
        storytellerThoughts={lastDebugPacket?.storytellerThoughts?.slice(-1)[0] ?? ''}
        updateItemContent={updateItemContent}
        updatePlayerJournalContent={updatePlayerJournalContent}
        visualizerImageScene={visualizerImageScene}
        visualizerImageUrl={visualizerImageUrl}
      /> : null}
    </>
  );
}

export default App;
