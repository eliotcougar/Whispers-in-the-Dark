
/**
 * @file App.tsx
 * @description Main application component wiring together UI and game logic.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

import * as React from 'react';
import { useGameLogic } from '../../hooks/useGameLogic';
import SceneDisplay from '../SceneDisplay';
import ActionOptions from '../ActionOptions';
import InventoryDisplay from '../InventoryDisplay';
import LocationItemsDisplay from '../LocationItemsDisplay';
import LoadingSpinner from '../LoadingSpinner';
import ErrorDisplay from '../ErrorDisplay';
import QuestInfoBox from '../QuestInfoBox';
import MainToolbar from '../MainToolbar';
import ModelUsageIndicators from '../ModelUsageIndicators';
import TitleMenu from '../TitleMenu';
import DialogueDisplay from '../DialogueDisplay';
import DebugView from '../DebugView';
import ItemChangeAnimator from '../ItemChangeAnimator';
import CustomGameSetupScreen from '../CustomGameSetupScreen';
import SettingsDisplay from '../SettingsDisplay';
import InfoDisplay from '../InfoDisplay';
import Footer from './Footer';
import AppModals from './AppModals';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useModalState } from '../../hooks/useModalState';
import { findTravelPath, TravelStep } from '../../utils/mapPathfinding';
import { isDescendantIdOf } from '../../utils/mapGraphUtils';
import {
  applyNestedCircleLayout,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
} from '../../utils/mapLayoutUtils';

import { saveGameStateToLocalStorage } from '../../services/storage';

import {
  FREE_FORM_ACTION_COST,
  FREE_FORM_ACTION_MAX_LENGTH,
} from '../../constants';
import { ThemePackName } from '../../types';



const AUTOSAVE_DEBOUNCE_TIME = 1500;


function App() {
  const { clearProgress } = useLoadingProgress();
  const gameLogicRef = useRef<ReturnType<typeof useGameLogic> | null>(null);
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
    gatherCurrentGameState: () => gameLogicRef.current!.gatherCurrentGameState(),
    applyLoadedGameState: (args) => gameLogicRef.current!.applyLoadedGameState(args),
    setError: (msg) => gameLogicRef.current!.setError(msg),
    setIsLoading: (val) => gameLogicRef.current!.setIsLoading(val),
    isLoading: gameLogicRef.current?.isLoading,
    dialogueState: gameLogicRef.current?.dialogueState,
    hasGameBeenInitialized: gameLogicRef.current?.hasGameBeenInitialized,
  });


  const gameLogic = useGameLogic({
    playerGenderProp: playerGender,
    enabledThemePacksProp: enabledThemePacks,
    stabilityLevelProp: stabilityLevel,
    chaosLevelProp: chaosLevel,
    onSettingsUpdateFromLoad: updateSettingsFromLoad,
    initialSavedStateFromApp: initialSavedState,
    isAppReady: appReady,
  });
  gameLogicRef.current = gameLogic;

  const {
    currentTheme,
    currentScene, mainQuest, currentObjective, actionOptions,
    inventory, itemsHere, itemPresenceByNode, gameLog, isLoading, error, lastActionLog, themeHistory, mapData,
    currentMapNodeId, mapLayoutConfig,
    allCharacters,
    score, freeFormActionText, setFreeFormActionText,
    handleFreeFormActionSubmit, objectiveAnimationType, handleActionSelect,
    handleItemInteraction, handleTakeLocationItem, handleRetry, executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection,
    isAwaitingManualShiftThemeSelection,
    startCustomGame,
    gatherCurrentGameState, hasGameBeenInitialized, handleStartNewGameFromButton,
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
  } = gameLogic;

  useEffect(() => {
    if (!isLoading) {
      clearProgress();
    }
  }, [isLoading, clearProgress]);

  const prevGameLogLength = useRef(gameLog.length);
  const prevSceneRef = useRef(currentScene);
  const autosaveTimeoutRef = useRef<number | null>(null);

  const {
    isVisualizerVisible,
    setIsVisualizerVisible,
    visualizerImageUrl,
    setVisualizerImageUrl,
    visualizerImageScene,
    setVisualizerImageScene,
    isKnowledgeBaseVisible,
    setIsKnowledgeBaseVisible,
    isSettingsVisible,
    setIsSettingsVisible,
    isInfoVisible,
    setIsInfoVisible,
    isMapVisible,
    setIsMapVisible,
    userRequestedTitleMenuOpen,
    setUserRequestedTitleMenuOpen,
    shouldReturnToTitleMenu,
    setShouldReturnToTitleMenu,
    isHistoryVisible,
    setIsHistoryVisible,
    isDebugViewVisible,
    setIsDebugViewVisible,
    isCustomGameSetupVisible,
    setIsCustomGameSetupVisible,
    isManualShiftThemeSelectionVisible,
    setIsManualShiftThemeSelectionVisible,
    shiftConfirmOpen,
    setShiftConfirmOpen,
    newGameFromMenuConfirmOpen,
    setNewGameFromMenuConfirmOpen,
    loadGameFromMenuConfirmOpen,
    setLoadGameFromMenuConfirmOpen,
    newCustomGameConfirmOpen,
    setNewCustomGameConfirmOpen,
  } = useModalState();

  const effectiveIsTitleMenuOpen = userRequestedTitleMenuOpen || (appReady && !hasGameBeenInitialized && !isLoading && !isCustomGameSetupVisible && !isManualShiftThemeSelectionVisible);

  const isAnyModalOrDialogueActive = isVisualizerVisible || isKnowledgeBaseVisible || isSettingsVisible || isInfoVisible || isMapVisible || isHistoryVisible || isDebugViewVisible || !!dialogueState || effectiveIsTitleMenuOpen || shiftConfirmOpen || newGameFromMenuConfirmOpen || loadGameFromMenuConfirmOpen || isCustomGameSetupVisible || newCustomGameConfirmOpen || isManualShiftThemeSelectionVisible;


  useEffect(() => {
    if (isAnyModalOrDialogueActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
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

  useEffect(() => {
    if (isLoading || !hasGameBeenInitialized || !appReady || !!dialogueState) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

    autosaveTimeoutRef.current = window.setTimeout(() => {
      const gameStateToSave = gatherCurrentGameState();
      saveGameStateToLocalStorage(gameStateToSave);
    }, AUTOSAVE_DEBOUNCE_TIME);

    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [
    gatherCurrentGameState, isLoading, hasGameBeenInitialized, appReady, dialogueState,
    currentTheme, currentScene, actionOptions, mainQuest, currentObjective,
    inventory, gameLog, lastActionLog, themeHistory, mapData, currentMapNodeId, mapLayoutConfig,
    allCharacters, score,
    localTime, localEnvironment, localPlace, playerGender, enabledThemePacks,
    stabilityLevel, chaosLevel, turnsSinceLastShift, isCustomGameMode, isAwaitingManualShiftThemeSelection,
  ]);



  const canPerformFreeAction = score >= FREE_FORM_ACTION_COST && !isLoading && hasGameBeenInitialized && !dialogueState;

  const setGeneratedImageCache = useCallback((url: string, scene: string) => {
    setVisualizerImageUrl(url);
    setVisualizerImageScene(scene);
  }, [setVisualizerImageUrl, setVisualizerImageScene]);

  const confirmShift = useCallback(() => {
    executeManualRealityShift();
    setShiftConfirmOpen(false);
  }, [executeManualRealityShift, setShiftConfirmOpen]);

  const handleOpenManualShiftConfirm = useCallback(
    () => setShiftConfirmOpen(true),
    [setShiftConfirmOpen]
  );

  const handleOpenHistory = useCallback(
    () => setIsHistoryVisible(true),
    [setIsHistoryVisible]
  );

  const handleOpenKnowledgeBase = useCallback(
    () => setIsKnowledgeBaseVisible(true),
    [setIsKnowledgeBaseVisible]
  );

  const handleOpenMap = useCallback(() => setIsMapVisible(true), [setIsMapVisible]);

  const handleOpenTitleMenu = useCallback(
    () => setUserRequestedTitleMenuOpen(true),
    [setUserRequestedTitleMenuOpen]
  );

  const handleOpenVisualizer = useCallback(
    () => setIsVisualizerVisible(true),
    [setIsVisualizerVisible]
  );

  const handleCloseDebugView = useCallback(
    () => setIsDebugViewVisible(false),
    [setIsDebugViewVisible]
  );

  const handleCloseTitleMenu = useCallback(
    () => setUserRequestedTitleMenuOpen(false),
    [setUserRequestedTitleMenuOpen]
  );

  const handleCloseMap = useCallback(() => setIsMapVisible(false), [setIsMapVisible]);

  const handleRetryClick = useCallback(() => {
    void handleRetry();
  }, [handleRetry]);

  const handleFreeFormActionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFreeFormActionText(e.target.value);
    },
    [setFreeFormActionText]
  );

  const handleCancelLoadGameFromMenu = useCallback(() => {
    setLoadGameFromMenuConfirmOpen(false);
    setUserRequestedTitleMenuOpen(true);
  }, [setLoadGameFromMenuConfirmOpen, setUserRequestedTitleMenuOpen]);

  const handleCancelShift = useCallback(
    () => setShiftConfirmOpen(false),
    [setShiftConfirmOpen]
  );

  const handleCancelNewCustomGame = useCallback(() => {
    setNewCustomGameConfirmOpen(false);
    setUserRequestedTitleMenuOpen(true);
  }, [setNewCustomGameConfirmOpen, setUserRequestedTitleMenuOpen]);

  const handleCancelNewGameFromMenu = useCallback(() => {
    setNewGameFromMenuConfirmOpen(false);
    setUserRequestedTitleMenuOpen(true);
  }, [setNewGameFromMenuConfirmOpen, setUserRequestedTitleMenuOpen]);

  const handleToggleThemePackStable = useCallback(
    (packName: ThemePackName) => {
      setEnabledThemePacks(prevPacks => {
        const newPacks = prevPacks.includes(packName)
          ? prevPacks.filter(p => p !== packName)
          : [...prevPacks, packName];
        if (newPacks.length === 0) {
          alert('At least one theme pack must be enabled.');
          return prevPacks;
        }
        return newPacks;
      });
    },
    [setEnabledThemePacks]
  );

  useEffect(() => {
    if (isAwaitingManualShiftThemeSelection && !isManualShiftThemeSelectionVisible) {
      setIsManualShiftThemeSelectionVisible(true);
    }
  }, [isAwaitingManualShiftThemeSelection, isManualShiftThemeSelectionVisible, setIsManualShiftThemeSelectionVisible]);

  const handleManualShiftThemeSelected = useCallback(
    (themeName: string) => {
      setIsManualShiftThemeSelectionVisible(false);
      completeManualShiftWithSelectedTheme(themeName);
    },
    [completeManualShiftWithSelectedTheme, setIsManualShiftThemeSelectionVisible]
  );

  const handleCancelManualShiftThemeSelection = useCallback(() => {
    setIsManualShiftThemeSelectionVisible(false);
    cancelManualShiftThemeSelection();
  }, [cancelManualShiftThemeSelection, setIsManualShiftThemeSelectionVisible]);

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
    setUserRequestedTitleMenuOpen(false);
    if (hasGameBeenInitialized) {
      setNewGameFromMenuConfirmOpen(true);
    } else {
      handleStartNewGameFromButton();
    }
  }, [hasGameBeenInitialized, handleStartNewGameFromButton, setNewGameFromMenuConfirmOpen, setUserRequestedTitleMenuOpen]);

  const confirmNewGameFromMenu = useCallback(() => {
    setNewGameFromMenuConfirmOpen(false);
    handleStartNewGameFromButton();
  }, [handleStartNewGameFromButton, setNewGameFromMenuConfirmOpen]);

  const handleLoadGameFromMenu = useCallback(() => {
    setUserRequestedTitleMenuOpen(false);
    if (hasGameBeenInitialized) {
      setLoadGameFromMenuConfirmOpen(true);
    } else {
      handleLoadFromFileClick();
    }
  }, [hasGameBeenInitialized, handleLoadFromFileClick, setLoadGameFromMenuConfirmOpen, setUserRequestedTitleMenuOpen]);

  const confirmLoadGameFromMenu = useCallback(() => {
    setLoadGameFromMenuConfirmOpen(false);
    handleLoadFromFileClick();
  }, [handleLoadFromFileClick, setLoadGameFromMenuConfirmOpen]);

  const handleSaveGameFromMenu = useCallback(() => {
    setUserRequestedTitleMenuOpen(false);
    handleSaveToFile();
  }, [handleSaveToFile, setUserRequestedTitleMenuOpen]);

  const openSettingsFromMenu = useCallback(() => {
    setUserRequestedTitleMenuOpen(false);
    setShouldReturnToTitleMenu(true);
    setIsSettingsVisible(true);
  }, [setUserRequestedTitleMenuOpen, setShouldReturnToTitleMenu, setIsSettingsVisible]);

  const closeSettings = useCallback(() => {
    setIsSettingsVisible(false);
    if (shouldReturnToTitleMenu || !hasGameBeenInitialized) {
      setUserRequestedTitleMenuOpen(true);
    }
    setShouldReturnToTitleMenu(false);
  }, [shouldReturnToTitleMenu, hasGameBeenInitialized, setIsSettingsVisible, setShouldReturnToTitleMenu, setUserRequestedTitleMenuOpen]);

  const openInfoFromMenu = useCallback(() => {
    setUserRequestedTitleMenuOpen(false);
    setShouldReturnToTitleMenu(true);
    setIsInfoVisible(true);
  }, [setUserRequestedTitleMenuOpen, setShouldReturnToTitleMenu, setIsInfoVisible]);

  const closeInfo = useCallback(() => {
    setIsInfoVisible(false);
    if (shouldReturnToTitleMenu || !hasGameBeenInitialized) {
      setUserRequestedTitleMenuOpen(true);
    }
    setShouldReturnToTitleMenu(false);
  }, [shouldReturnToTitleMenu, hasGameBeenInitialized, setIsInfoVisible, setShouldReturnToTitleMenu, setUserRequestedTitleMenuOpen]);


  const handleOpenCustomGameSetup = useCallback(() => {
    setUserRequestedTitleMenuOpen(false);
    if (hasGameBeenInitialized) {
      setNewCustomGameConfirmOpen(true);
    } else {
      setIsCustomGameSetupVisible(true);
    }
  }, [hasGameBeenInitialized, setIsCustomGameSetupVisible, setNewCustomGameConfirmOpen, setUserRequestedTitleMenuOpen]);

  const confirmNewCustomGame = useCallback(() => {
    setNewCustomGameConfirmOpen(false);
    setIsCustomGameSetupVisible(true);
  }, [setIsCustomGameSetupVisible, setNewCustomGameConfirmOpen]);

  const handleCloseCustomGameSetup = useCallback(() => {
    setIsCustomGameSetupVisible(false);
    setUserRequestedTitleMenuOpen(true);
  }, [setIsCustomGameSetupVisible, setUserRequestedTitleMenuOpen]);

  const handleCustomThemeSelectedForNewGame = useCallback(
    (themeName: string) => {
      setIsCustomGameSetupVisible(false);
      startCustomGame(themeName);
    },
    [setIsCustomGameSetupVisible, startCustomGame]
  );

  const [mapInitialViewBox, setMapInitialViewBox] = useState(mapViewBox);
  const travelPath: TravelStep[] | null = React.useMemo(() => {
    // Using globalTurnNumber to force recalculation each turn
    void globalTurnNumber;
    if (!destinationNodeId || !currentMapNodeId) return null;
    if (
      currentMapNodeId === destinationNodeId ||
      isDescendantIdOf(mapData, currentMapNodeId, destinationNodeId)
    ) {
      return null;
    }
    return findTravelPath(mapData, currentMapNodeId, destinationNodeId);
  }, [destinationNodeId, currentMapNodeId, mapData, globalTurnNumber]);
  const prevMapVisibleRef = useRef(false);
  useEffect(() => {
    if (isMapVisible && !prevMapVisibleRef.current) {
      const layoutNodes = applyNestedCircleLayout(
        mapData.nodes.filter(n => n.themeName === currentTheme?.name).map(n => ({ ...n })),
        {
          padding:
            mapLayoutConfig?.NESTED_PADDING ?? DEFAULT_NESTED_PADDING,
          anglePadding:
            mapLayoutConfig?.NESTED_ANGLE_PADDING ?? DEFAULT_NESTED_ANGLE_PADDING,
        }
      );
      handleMapNodesPositionChange(layoutNodes);

      const parts = mapViewBox.split(' ').map(parseFloat);
      if (parts.length === 4) {
        const [, , vw, vh] = parts;
        const node = layoutNodes.find(n => n.id === currentMapNodeId);
        if (node && !isNaN(vw) && !isNaN(vh)) {
          setMapInitialViewBox(
            `${node.position.x - vw / 2} ${node.position.y - vh / 2} ${vw} ${vh}`
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

        <p className="mt-4 text-xl text-sky-400">Initializing application...</p>
      </div>
    );
  }


  return (
    <>
      <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 flex flex-col items-center">
        <header className="w-full max-w-screen-xl mb-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400 tracking-wider title-font">
            Whispers in the Dark
          </h1>

          {hasGameBeenInitialized ? <p className="text-slate-400 text-lg">An Adventure in Shifting Realities
            {isCustomGameMode ? <span className="block text-xs text-orange-400">(Custom Game - Random Shifts Disabled)</span> : null}

            {currentTheme ? <span className="block text-xs text-purple-400">Current Theme: {currentTheme.name}</span> : null}
          </p> : null}
        </header>

        {error && !isLoading && !dialogueState && hasGameBeenInitialized ? <div className="w-full max-w-3xl my-4">
          <ErrorDisplay
            message={error}
            onRetry={isLoading ? undefined : handleRetryClick}
            />
        </div> : null}

        {error && !hasGameBeenInitialized ? <div className="w-full max-w-3xl my-4">
          <ErrorDisplay message={error} onRetry={handleRetryClick} />
        </div> : null}

        <main className={`w-full max-w-screen-xl grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow ${(isAnyModalOrDialogueActive) ? 'filter blur-sm pointer-events-none' : ''}`}>
          <div className="lg:col-span-2 space-y-2">
            {hasGameBeenInitialized ? <MainToolbar
              currentSceneExists={!!currentScene}
              currentThemeName={currentTheme?.name || null}
              isLoading={isLoading || !!dialogueState}
              onManualRealityShift={handleOpenManualShiftConfirm}
              onOpenHistory={handleOpenHistory}
              onOpenKnowledgeBase={handleOpenKnowledgeBase}
              onOpenMap={handleOpenMap}
              onOpenTitleMenu={handleOpenTitleMenu}
              onOpenVisualizer={handleOpenVisualizer}
              score={score}
              turnsSinceLastShift={turnsSinceLastShift}
                /> : null}

            {hasGameBeenInitialized ? <div className="flex items-center my-2">
              <ModelUsageIndicators />

              <div className="flex-grow border-t border-slate-600 ml-2" />
            </div> : null}

            {isLoading && !dialogueState && !isDialogueExiting && hasGameBeenInitialized ? <div className="my-4 flex justify-center">
              <LoadingSpinner loadingReason={loadingReason} />
            </div> : null}

            {isLoading && !hasGameBeenInitialized ? !error && <LoadingSpinner loadingReason={loadingReason} /> : null}


            <SceneDisplay
              allCharacters={allCharacters}
              currentThemeName={currentTheme?.name || null}
              description={hasGameBeenInitialized ? currentScene : " "}
              inventory={inventory}
              lastActionLog={hasGameBeenInitialized ? lastActionLog : null}
              localEnvironment={localEnvironment}
              localPlace={localPlace}
              localTime={localTime}
              mapData={mapData.nodes}
            />

            {actionOptions.length > 0 && (typeof error !== 'string' || !error.includes("API Key")) && hasGameBeenInitialized ? <>
              <ActionOptions
                allCharacters={allCharacters}
                currentThemeName={currentTheme?.name || null}
                disabled={isLoading || !!dialogueState}
                inventory={inventory}
                mapData={mapData.nodes}
                onActionSelect={handleActionSelect}
                options={actionOptions}
                />

              <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-lg shadow">
                <label className="block text-sm font-medium text-amber-300 mb-1" htmlFor="freeFormAction">
                  Perform Custom Action (Cost: {FREE_FORM_ACTION_COST} Score Points)
                </label>

                <div className="flex space-x-2">
                  <input
                    aria-label="Custom action input"
                    className="flex-grow p-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-600 disabled:text-slate-400"
                    disabled={!canPerformFreeAction}
                    id="freeFormAction"
                    maxLength={FREE_FORM_ACTION_MAX_LENGTH}
                    onChange={handleFreeFormActionChange}
                    placeholder="Type your custom action here..."
                    type="text"
                    value={freeFormActionText}
                    />

                  <button
                    aria-label="Submit custom action"
                    className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-md shadow
                                disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed
                                transition-colors duration-150"
                    disabled={!canPerformFreeAction || freeFormActionText.trim() === ""}
                    onClick={handleFreeFormActionSubmit}
                    >
                    Submit
                  </button>
                </div>

                {!canPerformFreeAction && score < FREE_FORM_ACTION_COST && !isLoading && (
                <p className="text-xs text-red-400 mt-1">Not enough score points.</p>
                  )}

                {canPerformFreeAction ? <p className="text-xs text-slate-400 mt-1">Max {FREE_FORM_ACTION_MAX_LENGTH} characters.</p> : null}
              </div>
            </> : null}
          </div>

          <div className="lg:col-span-2 space-y-2 flex flex-col">
            <QuestInfoBox
              currentObjective={hasGameBeenInitialized ? currentObjective : null}
              mainQuest={hasGameBeenInitialized ? mainQuest : null}
              objectiveAnimationType={objectiveAnimationType}
          />

            <LocationItemsDisplay
              currentNodeId={currentMapNodeId}
              disabled={isLoading || !!dialogueState || effectiveIsTitleMenuOpen || isCustomGameSetupVisible || isManualShiftThemeSelectionVisible }
              items={itemsHere}
              mapNodes={mapData.nodes}
              onTakeItem={handleTakeLocationItem}
          />

            <InventoryDisplay
              disabled={isLoading || !!dialogueState || effectiveIsTitleMenuOpen || isCustomGameSetupVisible || isManualShiftThemeSelectionVisible }
              items={inventory}
              onDropItem={gameLogic.handleDropItem}
              onItemInteract={handleItemInteraction}
            />
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
        allCharacters={allCharacters}
        currentThemeName={currentTheme?.name || null}
        history={dialogueState?.history || []}
        inventory={inventory}
        isDialogueExiting={isDialogueExiting}
        isLoading={isLoading}
        isVisible={!!dialogueState}
        loadingReason={loadingReason}
        mapData={mapData.nodes}
        onClose={handleForceExitDialogue}
        onOptionSelect={handleDialogueOptionSelectSafe}
        options={dialogueState?.options || []}
        participants={dialogueState?.participants || []}
      />

      <DebugView
        debugPacket={lastDebugPacket}
        gameStateStack={gameStateStack}
        isVisible={isDebugViewVisible}
        onClose={handleCloseDebugView}
        onUndoTurn={handleUndoTurn}
        travelPath={travelPath}
        />

      <TitleMenu
        isGameActive={hasGameBeenInitialized}
        isVisible={effectiveIsTitleMenuOpen}
        onClose={handleCloseTitleMenu}
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
        disabledThemeName={currentTheme?.name || null}
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

      <InfoDisplay isVisible={isInfoVisible} onClose={closeInfo} />

      {hasGameBeenInitialized && currentTheme ? <AppModals
        allCharacters={allCharacters}
        cancelLoadGameFromMenu={handleCancelLoadGameFromMenu}
        cancelNewCustomGame={handleCancelNewCustomGame}
        cancelNewGameFromMenu={handleCancelNewGameFromMenu}
        cancelShift={handleCancelShift}
        confirmLoadGameFromMenu={confirmLoadGameFromMenu}
        confirmNewCustomGame={confirmNewCustomGame}
        confirmNewGameFromMenu={confirmNewGameFromMenu}
        confirmShift={confirmShift}
        currentMapNodeId={currentMapNodeId}
        currentScene={currentScene}
        currentTheme={currentTheme}
        currentThemeName={currentTheme?.name || null}
        destinationNodeId={destinationNodeId}
        gameLog={gameLog}
        initialLayoutConfig={mapLayoutConfig}
        initialViewBox={mapInitialViewBox}
        isCustomGameModeShift={isCustomGameMode}
        isHistoryVisible={isHistoryVisible}
        isKnowledgeBaseVisible={isKnowledgeBaseVisible}
        isMapVisible={isMapVisible}
        isVisualizerVisible={isVisualizerVisible}
        itemPresenceByNode={itemPresenceByNode}
        loadGameFromMenuConfirmOpen={loadGameFromMenuConfirmOpen}
        localEnvironment={localEnvironment}
        localPlace={localPlace}
        localTime={localTime}
        mapData={mapData}
        newCustomGameConfirmOpen={newCustomGameConfirmOpen}
        newGameFromMenuConfirmOpen={newGameFromMenuConfirmOpen}
        onCloseInfo={closeInfo}
        onCloseMap={handleCloseMap}
        onLayoutConfigChange={handleMapLayoutConfigChange}
        onNodesPositioned={handleMapNodesPositionChange}
        onSelectDestination={handleSelectDestinationNode}
        onViewBoxChange={handleMapViewBoxChange}
        setGeneratedImage={setGeneratedImageCache}
        setIsHistoryVisible={setIsHistoryVisible}
        setIsKnowledgeBaseVisible={setIsKnowledgeBaseVisible}
        setIsVisualizerVisible={setIsVisualizerVisible}
        shiftConfirmOpen={shiftConfirmOpen}
        themeHistory={themeHistory}
        visualizerImageScene={visualizerImageScene}
        visualizerImageUrl={visualizerImageUrl}
      /> : null}
    </>
  );
}

export default App;
