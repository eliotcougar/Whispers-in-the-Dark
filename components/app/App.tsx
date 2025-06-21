
/**
 * @file App.tsx
 * @description Main application component wiring together UI and game logic.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

import * as React from 'react';
import { useGameLogic } from '../../hooks/useGameLogic';
import SceneDisplay from '../SceneDisplay';
import ActionOptions from '../ActionOptions';
import InventoryDisplay from '../inventory/InventoryDisplay';
import LocationItemsDisplay from '../inventory/LocationItemsDisplay';
import LoadingSpinner from '../LoadingSpinner';
import ErrorDisplay from '../ErrorDisplay';
import TextBox from '../elements/TextBox';
import MainToolbar from '../MainToolbar';
import ModelUsageIndicators from '../ModelUsageIndicators';
import TitleMenu from '../modals/TitleMenu';
import DialogueDisplay from '../DialogueDisplay';
import DebugView from '../debug/DebugView';
import ItemChangeAnimator from '../inventory/ItemChangeAnimator';
import CustomGameSetupScreen from '../modals/CustomGameSetupScreen';
import SettingsDisplay from '../modals/SettingsDisplay';
import InfoDisplay from '../modals/InfoDisplay';
import Footer from './Footer';
import AppModals from './AppModals';
import AppHeader from './AppHeader';
import FreeActionInput from './FreeActionInput';
import { buildHighlightableEntities } from '../../utils/highlightHelper';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useAppModals } from '../../hooks/useAppModals';
import { useAutosave } from '../../hooks/useAutosave';
import { findTravelPath, TravelStep } from '../../utils/mapPathfinding';
import { isDescendantIdOf } from '../../utils/mapGraphUtils';
import { applyNestedCircleLayout } from '../../utils/mapLayoutUtils';


import {
  FREE_FORM_ACTION_COST,
} from '../../constants';
import { ThemePackName } from '../../types';


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
    gatherCurrentGameState: () => getGameLogic().gatherCurrentGameState(),
    applyLoadedGameState: (args) => getGameLogic().applyLoadedGameState(args),
    setError: (msg) => { getGameLogic().setError(msg); },
    setIsLoading: (val) => { getGameLogic().setIsLoading(val); },
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
  } = useAppModals();

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

  useAutosave({
    gatherCurrentGameState,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    dependencies: [
      currentTheme, currentScene, actionOptions, mainQuest, currentObjective,
      inventory, gameLog, lastActionLog, themeHistory, mapData, currentMapNodeId,
      mapLayoutConfig, allCharacters, score, localTime, localEnvironment, localPlace,
      playerGender, enabledThemePacks, stabilityLevel, chaosLevel, turnsSinceLastShift,
      isCustomGameMode, isAwaitingManualShiftThemeSelection,
    ],
  });




  const canPerformFreeAction = score >= FREE_FORM_ACTION_COST && !isLoading && hasGameBeenInitialized && !dialogueState;

  const questHighlightEntities = React.useMemo(
    () =>
      buildHighlightableEntities(
        inventory,
        mapData.nodes,
        allCharacters,
        currentTheme ? currentTheme.name : null
      ),
    [inventory, mapData.nodes, allCharacters, currentTheme]
  );

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
    return findTravelPath(mapData, currentMapNodeId, destinationNodeId);
  }, [destinationNodeId, currentMapNodeId, mapData, globalTurnNumber]);
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

            {isLoading && !dialogueState && !isDialogueExiting && hasGameBeenInitialized ? <div className="my-4 flex justify-center">
              <LoadingSpinner loadingReason={loadingReason} />
            </div> : null}

            {isLoading && !hasGameBeenInitialized ? !error && <LoadingSpinner loadingReason={loadingReason} /> : null}

            {!hasGameBeenInitialized ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg flex-grow min-h-48" />
            ) : (
              <>
                <SceneDisplay
                  allCharacters={allCharacters}
                  currentThemeName={currentTheme ? currentTheme.name : null}
                  description={currentScene}
                  inventory={inventory}
                  lastActionLog={lastActionLog}
                  localEnvironment={localEnvironment}
                  localPlace={localPlace}
                  localTime={localTime}
                  mapData={mapData.nodes}
                />

                <ActionOptions
                  allCharacters={allCharacters}
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
              <>
                { mainQuest ? (
                  <TextBox
                    backgroundColorClass="bg-purple-800/50"
                    borderColorClass="border-purple-600"
                    borderWidthClass="border rounded-lg"
                    containerClassName="p-3 "
                    contentColorClass="text-purple-200"
                    contentFontClass="text-lg"
                    enableMobileTap={enableMobileTap}
                    header="Main Quest"
                    headerFont="lg"
                    headerPreset="purple"
                    highlightEntities={questHighlightEntities}
                    text={mainQuest}
                  />
                ) : null}

                {currentObjective ? (
                  <TextBox
                    backgroundColorClass="bg-amber-800/50"
                    borderColorClass="border-amber-600"
                    borderWidthClass="border rounded-lg"
                    containerClassName={`p-3 ${
                      objectiveAnimationType === 'success'
                        ? 'animate-objective-success'
                        : objectiveAnimationType === 'neutral'
                          ? 'animate-objective-neutral'
                          : ''
                    }`}
                    contentColorClass="text-amber-200"
                    contentFontClass="text-lg"
                    enableMobileTap={enableMobileTap}
                    header="Current Objective"
                    headerFont="lg"
                    headerPreset="amber"
                    highlightEntities={questHighlightEntities}
                    text={currentObjective}
                  />
                ) : null}

                <LocationItemsDisplay
                  currentNodeId={currentMapNodeId}
                  disabled={isLoading || !!dialogueState || effectiveIsTitleMenuOpen || isCustomGameSetupVisible || isManualShiftThemeSelectionVisible}
                  items={itemsHere}
                  mapNodes={mapData.nodes}
                  onTakeItem={handleTakeLocationItem}
                />

                <InventoryDisplay
                  disabled={isLoading || !!dialogueState || effectiveIsTitleMenuOpen || isCustomGameSetupVisible || isManualShiftThemeSelectionVisible}
                  items={inventory}
                  onDropItem={gameLogic.handleDropItem}
                  onItemInteract={handleItemInteraction}
                />

              </>
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
        allCharacters={allCharacters}
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
        debugPacket={lastDebugPacket}
        gameStateStack={gameStateStack}
        isVisible={isDebugViewVisible}
        onClose={closeDebugView}
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

      {hasGameBeenInitialized && currentTheme ? <AppModals
        allCharacters={allCharacters}
        currentMapNodeId={currentMapNodeId}
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
        onCloseHistory={closeHistory}
        onCloseKnowledgeBase={closeKnowledgeBase}
        onCloseMap={closeMap}
        onCloseVisualizer={closeVisualizer}
        onLayoutConfigChange={handleMapLayoutConfigChange}
        onNodesPositioned={handleMapNodesPositionChange}
        onSelectDestination={handleSelectDestinationNode}
        onViewBoxChange={handleMapViewBoxChange}
        setGeneratedImage={setGeneratedImageCache}
        shiftConfirmOpen={shiftConfirmOpen}
        themeHistory={themeHistory}
        visualizerImageScene={visualizerImageScene}
        visualizerImageUrl={visualizerImageUrl}
      /> : null}
    </>
  );
}

export default App;
