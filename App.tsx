
/**
 * @file App.tsx
 * @description Main application component wiring together UI and game logic.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useGameLogic } from './hooks/useGameLogic';
import SceneDisplay from './components/SceneDisplay';
import ActionOptions from './components/ActionOptions';
import InventoryDisplay from './components/InventoryDisplay';
import LocationItemsDisplay from './components/LocationItemsDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';
import HistoryDisplay from './components/HistoryDisplay';
import QuestInfoBox from './components/QuestInfoBox';
import ImageVisualizer from './components/ImageVisualizer';
import KnowledgeBase from './components/KnowledgeBase';
import SettingsDisplay from './components/SettingsDisplay';
import ConfirmationDialog from './components/ConfirmationDialog';
import InfoDisplay from './components/InfoDisplay';
import MainToolbar from './components/MainToolbar';
import ModelUsageIndicators from './components/ModelUsageIndicators';
import TitleMenu from './components/TitleMenu';
import DialogueDisplay from './components/DialogueDisplay';
import DebugView from './components/DebugView';
import ItemChangeAnimator from './components/ItemChangeAnimator';
import MapDisplay from './components/MapDisplay';
import CustomGameSetupScreen from './components/CustomGameSetupScreen';
import { useLoadingProgress } from './hooks/useLoadingProgress';
import { useSaveLoad } from './hooks/useSaveLoad';
import { useModalState } from './hooks/useModalState';
import { findTravelPath, TravelStep } from './utils/mapPathfinding';
import { isDescendantIdOf } from './utils/mapGraphUtils';
import {
  applyNestedCircleLayout,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
} from './utils/mapLayoutUtils';

import {
  saveGameStateToLocalStorage
} from "./services/storage";

import {
  FREE_FORM_ACTION_COST,
  FREE_FORM_ACTION_MAX_LENGTH,
  DEVELOPER
} from "./constants";



const AUTOSAVE_DEBOUNCE_TIME = 1500;


const App: React.FC = () => {
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

  const confirmShift = () => {
    executeManualRealityShift();
    setShiftConfirmOpen(false);
  };

  useEffect(() => {
    if (isAwaitingManualShiftThemeSelection && !isManualShiftThemeSelectionVisible) {
      setIsManualShiftThemeSelectionVisible(true);
    }
  }, [isAwaitingManualShiftThemeSelection, isManualShiftThemeSelectionVisible, setIsManualShiftThemeSelectionVisible]);

  const handleManualShiftThemeSelected = (themeName: string) => {
    setIsManualShiftThemeSelectionVisible(false);
    completeManualShiftWithSelectedTheme(themeName);
  };

  const handleCancelManualShiftThemeSelection = () => {
    setIsManualShiftThemeSelectionVisible(false);
    cancelManualShiftThemeSelection();
  };

  /**
   * Wrapper ensuring lint compliance for the async dialogue option handler.
   */
  const handleDialogueOptionSelectSafe = useCallback(
    (option: string) => {
      void handleDialogueOptionSelect(option);
    },
    [handleDialogueOptionSelect]
  );


  const handleNewGameFromMenu = () => {
    setUserRequestedTitleMenuOpen(false);
    if (hasGameBeenInitialized) {
      setNewGameFromMenuConfirmOpen(true);
    } else {
      handleStartNewGameFromButton();
    }
  };

  const confirmNewGameFromMenu = () => {
    setNewGameFromMenuConfirmOpen(false);
    handleStartNewGameFromButton();
  };

  const handleLoadGameFromMenu = () => {
    setUserRequestedTitleMenuOpen(false);
    if (hasGameBeenInitialized) {
      setLoadGameFromMenuConfirmOpen(true);
    } else {
      handleLoadFromFileClick();
    }
  };

  const confirmLoadGameFromMenu = () => {
    setLoadGameFromMenuConfirmOpen(false);
    handleLoadFromFileClick();
  };

  const handleSaveGameFromMenu = () => {
    setUserRequestedTitleMenuOpen(false);
    handleSaveToFile();
  }

  const openSettingsFromMenu = () => {
    setUserRequestedTitleMenuOpen(false);
    setIsSettingsVisible(true);
  };

  const closeSettings = () => {
    setIsSettingsVisible(false);
    if (userRequestedTitleMenuOpen || !hasGameBeenInitialized) {
      setUserRequestedTitleMenuOpen(true);
    }
  };

  const openInfoFromMenu = () => {
    setUserRequestedTitleMenuOpen(false);
    setIsInfoVisible(true);
  };

  const closeInfo = () => {
    setIsInfoVisible(false);
    if (userRequestedTitleMenuOpen || !hasGameBeenInitialized) {
      setUserRequestedTitleMenuOpen(true);
    }
  };


  const handleOpenCustomGameSetup = () => {
    setUserRequestedTitleMenuOpen(false);
    if (hasGameBeenInitialized) {
      setNewCustomGameConfirmOpen(true);
    } else {
      setIsCustomGameSetupVisible(true);
    }
  };

  const confirmNewCustomGame = () => {
    setNewCustomGameConfirmOpen(false);
    setIsCustomGameSetupVisible(true);
  };

  const handleCloseCustomGameSetup = () => {
    setIsCustomGameSetupVisible(false);
    setUserRequestedTitleMenuOpen(true);
  };

  const handleCustomThemeSelectedForNewGame = (themeName: string) => {
    setIsCustomGameSetupVisible(false);
    startCustomGame(themeName);
  };

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
          {hasGameBeenInitialized && (
            <p className="text-slate-400 text-lg">An Adventure in Shifting Realities
              {isCustomGameMode && <span className="block text-xs text-orange-400">(Custom Game - Random Shifts Disabled)</span>}
              {currentTheme && <span className="block text-xs text-purple-400">Current Theme: {currentTheme.name}</span>}
            </p>
          )}
        </header>

        {error && !isLoading && !dialogueState && hasGameBeenInitialized && (
          <div className="w-full max-w-3xl my-4">
            <ErrorDisplay
              message={error}
              onRetry={isLoading ? undefined : () => { void handleRetry(); }}
            />
          </div>
        )}
         {error && !hasGameBeenInitialized && (
            <div className="w-full max-w-3xl my-4">
                <ErrorDisplay message={error} onRetry={() => { void handleRetry(); }} />
            </div>
        )}

        <main className={`w-full max-w-screen-xl grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow ${(isAnyModalOrDialogueActive) ? 'filter blur-sm pointer-events-none' : ''}`}>
          <div className="lg:col-span-2 space-y-2">
            {hasGameBeenInitialized && (
              <MainToolbar
                score={score}
                isLoading={isLoading || !!dialogueState}
                currentThemeName={currentTheme?.name || null}
                currentSceneExists={!!currentScene}
                onOpenVisualizer={() => setIsVisualizerVisible(true)}
                onOpenKnowledgeBase={() => setIsKnowledgeBaseVisible(true)}
                onOpenHistory={() => setIsHistoryVisible(true)}
                onOpenMap={() => setIsMapVisible(true)}
                onOpenTitleMenu={() => setUserRequestedTitleMenuOpen(true)}
                onManualRealityShift={() => setShiftConfirmOpen(true)}
                turnsSinceLastShift={turnsSinceLastShift}
              />
            )}
            {hasGameBeenInitialized && (
              <div className="flex items-center my-2">
                <ModelUsageIndicators />
                <div className="flex-grow border-t border-slate-600 ml-2" />
              </div>
            )}

            {isLoading && !dialogueState && !isDialogueExiting && hasGameBeenInitialized && (
              <div className="my-4 flex justify-center">
                <LoadingSpinner loadingReason={loadingReason} />
              </div>
            )}
            {isLoading && !hasGameBeenInitialized && (
                 !error && <LoadingSpinner loadingReason={loadingReason} />
            )}


            <SceneDisplay
              description={hasGameBeenInitialized ? currentScene : " "}
              lastActionLog={hasGameBeenInitialized ? lastActionLog : null}
              inventory={inventory}
              mapData={mapData.nodes}
              allCharacters={allCharacters}
              currentThemeName={currentTheme?.name || null}
              localTime={localTime}
              localEnvironment={localEnvironment}
              localPlace={localPlace}
            />
            {actionOptions.length > 0 && (!error || !(error.includes("API Key"))) && hasGameBeenInitialized && (
              <>
                <ActionOptions
                  options={actionOptions}
                  onActionSelect={handleActionSelect}
                  disabled={isLoading || !!dialogueState}
                  inventory={inventory}
                  mapData={mapData.nodes}
                  allCharacters={allCharacters}
                  currentThemeName={currentTheme?.name || null}
                />
                <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-lg shadow">
                  <label htmlFor="freeFormAction" className="block text-sm font-medium text-amber-300 mb-1">
                    Perform Custom Action (Cost: {FREE_FORM_ACTION_COST} Score Points)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="freeFormAction"
                      value={freeFormActionText}
                      onChange={(e) => setFreeFormActionText(e.target.value)}
                      maxLength={FREE_FORM_ACTION_MAX_LENGTH}
                      className="flex-grow p-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-600 disabled:text-slate-400"
                      placeholder="Type your custom action here..."
                      disabled={!canPerformFreeAction}
                      aria-label="Custom action input"
                    />
                    <button
                      onClick={handleFreeFormActionSubmit}
                      disabled={!canPerformFreeAction || freeFormActionText.trim() === ""}
                      className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-md shadow
                                disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed
                                transition-colors duration-150"
                      aria-label="Submit custom action"
                    >
                      Submit
                    </button>
                  </div>
                  {!canPerformFreeAction && score < FREE_FORM_ACTION_COST && !isLoading && (
                    <p className="text-xs text-red-400 mt-1">Not enough score points.</p>
                  )}
                  {canPerformFreeAction && (
                    <p className="text-xs text-slate-400 mt-1">Max {FREE_FORM_ACTION_MAX_LENGTH} characters.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-2 space-y-2 flex flex-col">
          <QuestInfoBox
            mainQuest={hasGameBeenInitialized ? mainQuest : null}
            currentObjective={hasGameBeenInitialized ? currentObjective : null}
            objectiveAnimationType={objectiveAnimationType}
          />
          <LocationItemsDisplay
            items={itemsHere}
            onTakeItem={handleTakeLocationItem}
            disabled={isLoading || !!dialogueState || effectiveIsTitleMenuOpen || isCustomGameSetupVisible || isManualShiftThemeSelectionVisible }
            currentNodeId={currentMapNodeId}
            mapNodes={mapData.nodes}
          />
          <InventoryDisplay
            items={inventory}
            onItemInteract={handleItemInteraction}
            onDropItem={gameLogic.handleDropItem}
            disabled={isLoading || !!dialogueState || effectiveIsTitleMenuOpen || isCustomGameSetupVisible || isManualShiftThemeSelectionVisible }
            />
          </div>
        </main>

        <ItemChangeAnimator
          lastTurnChanges={lastTurnChanges}
          isGameBusy={isAnyModalOrDialogueActive || isLoading}
        />

        <footer className={`w-full max-w-screen-xl mt-12 text-center text-slate-500 text-sm ${(isAnyModalOrDialogueActive) ? 'filter blur-sm pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center">
            <p className={`text-left`}>&copy; {new Date().getFullYear()}. Developed by {DEVELOPER}, Codex, and Gemini. <br />Powered by Gemini.</p>
            <button
              onClick={() => setIsDebugViewVisible(!isDebugViewVisible)}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs rounded shadow-md transition-colors"
              aria-label="Open Debug View"
            >
              Debug
            </button>
          </div>
        </footer>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".json,application/json"
        className="hidden"
        aria-hidden="true"
      />

      <DialogueDisplay
        isVisible={!!dialogueState}
        onClose={handleForceExitDialogue}
        history={dialogueState?.history || []}
        options={dialogueState?.options || []}
        onOptionSelect={handleDialogueOptionSelectSafe}
        participants={dialogueState?.participants || []}
        isLoading={isLoading}
        isDialogueExiting={isDialogueExiting}
        inventory={inventory}
        mapData={mapData.nodes}
        allCharacters={allCharacters}
        currentThemeName={currentTheme?.name || null}
        loadingReason={loadingReason}
      />

      <DebugView
        isVisible={isDebugViewVisible}
        onClose={() => setIsDebugViewVisible(false)}
        debugPacket={lastDebugPacket}
        gameStateStack={gameStateStack}
        onUndoTurn={handleUndoTurn}
        travelPath={travelPath}
      />

      <TitleMenu
        isVisible={effectiveIsTitleMenuOpen}
        onClose={() => setUserRequestedTitleMenuOpen(false)}
        onNewGame={handleNewGameFromMenu}
        onCustomGame={handleOpenCustomGameSetup}
        onSaveGame={hasGameBeenInitialized ? handleSaveGameFromMenu : undefined}
        onLoadGame={handleLoadGameFromMenu}
        onOpenSettings={openSettingsFromMenu}
        onOpenInfo={openInfoFromMenu}
        isGameActive={hasGameBeenInitialized}
      />
      <CustomGameSetupScreen
        isVisible={isCustomGameSetupVisible}
        onClose={handleCloseCustomGameSetup}
        onThemeSelected={handleCustomThemeSelectedForNewGame}
      />
      <CustomGameSetupScreen
        isVisible={isManualShiftThemeSelectionVisible}
        onClose={handleCancelManualShiftThemeSelection}
        onThemeSelected={handleManualShiftThemeSelected}
        disabledThemeName={currentTheme?.name || null}
        titleText="Select Destination Theme"
        descriptionText="Choose the theme you wish to manually shift your reality to. The current theme is disabled."
      />
      <SettingsDisplay
        isVisible={isSettingsVisible}
        onClose={closeSettings}
        stabilityLevel={stabilityLevel}
        chaosLevel={chaosLevel}
        onStabilityChange={setStabilityLevel}
        onChaosChange={setChaosLevel}
        enabledThemePacks={enabledThemePacks}
        onToggleThemePack={(packName) => {
          setEnabledThemePacks(prevPacks => {
            const newPacks = prevPacks.includes(packName)
              ? prevPacks.filter(p => p !== packName)
              : [...prevPacks, packName];
            if (newPacks.length === 0) {
              alert("At least one theme pack must be enabled.");
              return prevPacks;
            }
            return newPacks;
          });
        }}
        playerGender={playerGender}
        onPlayerGenderChange={setPlayerGender}
        isCustomGameMode={isCustomGameMode}
      />

      <InfoDisplay
        isVisible={isInfoVisible}
        onClose={closeInfo}

      />


      {hasGameBeenInitialized && currentTheme && (
        <>
          <ImageVisualizer
            currentSceneDescription={currentScene}
            currentTheme={currentTheme}
            mapData={mapData.nodes}
            allCharacters={allCharacters}
            localTime={localTime}
            localEnvironment={localEnvironment}
            localPlace={localPlace}
            isVisible={isVisualizerVisible}
            onClose={() => setIsVisualizerVisible(false)}
            setGeneratedImage={setGeneratedImageCache}
            cachedImageUrl={visualizerImageUrl}
            cachedImageScene={visualizerImageScene}
          />
          <KnowledgeBase
            allCharacters={allCharacters}
            currentTheme={currentTheme}
            isVisible={isKnowledgeBaseVisible}
            onClose={() => setIsKnowledgeBaseVisible(false)}
          />
          <HistoryDisplay
            themeHistory={themeHistory}
            gameLog={gameLog}
            isVisible={isHistoryVisible}
            onClose={() => setIsHistoryVisible(false)}
          />
          <MapDisplay
            mapData={mapData}
            currentThemeName={currentTheme?.name || null}
            currentMapNodeId={currentMapNodeId}
            destinationNodeId={destinationNodeId}
            itemPresenceByNode={itemPresenceByNode}
            onSelectDestination={id => handleSelectDestinationNode(id)}
           initialLayoutConfig={mapLayoutConfig}
           initialViewBox={mapInitialViewBox}
            onNodesPositioned={handleMapNodesPositionChange}
           onLayoutConfigChange={handleMapLayoutConfigChange}
           onViewBoxChange={handleMapViewBoxChange}
            isVisible={isMapVisible}
            onClose={() => setIsMapVisible(false)}
          />
          <ConfirmationDialog
            isOpen={newGameFromMenuConfirmOpen}
            title="Confirm New Game"
            message="Are you sure you want to start a new game? Your current progress will be lost."
            onConfirm={confirmNewGameFromMenu}
            onCancel={() => {
              setNewGameFromMenuConfirmOpen(false);
              setUserRequestedTitleMenuOpen(true);
            }}
            confirmText="Start New Game"
            confirmButtonClass="bg-red-600 hover:bg-red-500"
          />
          <ConfirmationDialog
            isOpen={newCustomGameConfirmOpen}
            title="Confirm Custom Game"
            message="Are you sure you want to start a new custom game? Your current progress will be lost."
            onConfirm={confirmNewCustomGame}
            onCancel={() => {
              setNewCustomGameConfirmOpen(false);
              setUserRequestedTitleMenuOpen(true);
            }}
            confirmText="Start Custom Game"
            confirmButtonClass="bg-orange-600 hover:bg-orange-500"
          />
          <ConfirmationDialog
            isOpen={loadGameFromMenuConfirmOpen}
            title="Confirm Load Game"
            message="Are you sure you want to load a game? Your current progress will be overwritten if you load a new game."
            onConfirm={confirmLoadGameFromMenu}
            onCancel={() => {
              setLoadGameFromMenuConfirmOpen(false);
              setUserRequestedTitleMenuOpen(true);
            }}
            confirmText="Load Game"
            confirmButtonClass="bg-blue-600 hover:bg-blue-500"
          />
          <ConfirmationDialog
            isOpen={shiftConfirmOpen}
            title="Confirm Reality Shift"
            message={<>This will destabilize the current reality, leading to an <strong className="text-purple-400">immediate and unpredictable shift</strong> to a new theme. Are you sure you wish to proceed?</>}
            onConfirm={confirmShift}
            onCancel={() => setShiftConfirmOpen(false)}
            confirmText="Shift Reality"
            confirmButtonClass="bg-purple-600 hover:bg-purple-500"
            isCustomModeShift={isCustomGameMode}
          />
        </>
      )}
    </>
  );
};

export default App;
