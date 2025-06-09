
/**
 * @file App.tsx
 * @description Main application component wiring together UI and game logic.
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { FullGameState, ThemePackName } from './types';
import { useGameLogic } from './hooks/useGameLogic';
import SceneDisplay from './components/SceneDisplay';
import ActionOptions from './components/ActionOptions';
import InventoryDisplay from './components/InventoryDisplay';
import GameLogDisplay from './components/GameLogDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';
import ThemeMemoryDisplay from './components/ThemeMemoryDisplay';
import ImageVisualizer from './components/ImageVisualizer';
import KnowledgeBase from './components/KnowledgeBase';
import SettingsDisplay from './components/SettingsDisplay';
import ConfirmationDialog from './components/ConfirmationDialog';
import InfoDisplay from './components/InfoDisplay';
import MainToolbar from './components/MainToolbar';
import TitleMenu from './components/TitleMenu';
import DialogueDisplay from './components/DialogueDisplay';
import DebugView from './components/DebugView';
import ItemChangeAnimator from './components/ItemChangeAnimator';
import MapDisplay from './components/MapDisplay';
import CustomGameSetupScreen from './components/CustomGameSetupScreen';
import { useLoadingProgress } from './hooks/useLoadingProgress';

import {
  saveGameStateToFile,
  loadGameStateFromFile
} from "./services/saveLoadService";
import {
  saveGameStateToLocalStorage,
  loadGameStateFromLocalStorage
} from "./services/storage";

import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_ENABLED_THEME_PACKS,
  DEFAULT_STABILITY_LEVEL,
  DEFAULT_CHAOS_LEVEL,
  FREE_FORM_ACTION_COST,
  FREE_FORM_ACTION_MAX_LENGTH,
  DEVELOPER
} from "./constants";



const AUTOSAVE_DEBOUNCE_TIME = 1500;


const App: React.FC = () => {
  const { clearProgress } = useLoadingProgress();
  const [playerGender, setPlayerGender] = useState<string>(DEFAULT_PLAYER_GENDER);
  const [enabledThemePacks, setEnabledThemePacks] = useState<ThemePackName[]>([...DEFAULT_ENABLED_THEME_PACKS]);
  const [stabilityLevel, setStabilityLevel] = useState<number>(DEFAULT_STABILITY_LEVEL);
  const [chaosLevel, setChaosLevel] = useState<number>(DEFAULT_CHAOS_LEVEL);
  const [initialSavedStateForLogic, setInitialSavedStateForLogic] = useState<FullGameState | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const loadInitialData = () => {
      const loadedState = loadGameStateFromLocalStorage();
      if (loadedState) {
        setPlayerGender(loadedState.playerGender ?? DEFAULT_PLAYER_GENDER);
        setEnabledThemePacks(loadedState.enabledThemePacks ?? [...DEFAULT_ENABLED_THEME_PACKS]);
        setStabilityLevel(loadedState.stabilityLevel ?? DEFAULT_STABILITY_LEVEL);
        setChaosLevel(loadedState.chaosLevel ?? DEFAULT_CHAOS_LEVEL);
        setInitialSavedStateForLogic(loadedState);
      } else {
        setInitialSavedStateForLogic(null);
      }
      setAppReady(true);
    };
    // Load initial data and update settings; no async operations needed here.
    loadInitialData();
  }, []);


  const handleSettingsUpdateFromLoad = useCallback((loadedSettings: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks' | 'stabilityLevel' | 'chaosLevel'>>) => {
    if (loadedSettings.playerGender !== undefined) setPlayerGender(loadedSettings.playerGender);
    if (loadedSettings.enabledThemePacks !== undefined) setEnabledThemePacks(loadedSettings.enabledThemePacks);
    if (loadedSettings.stabilityLevel !== undefined) setStabilityLevel(loadedSettings.stabilityLevel);
    if (loadedSettings.chaosLevel !== undefined) setChaosLevel(loadedSettings.chaosLevel);
  }, []);


  const gameLogic = useGameLogic({
    playerGenderProp: playerGender,
    enabledThemePacksProp: enabledThemePacks,
    stabilityLevelProp: stabilityLevel,
    chaosLevelProp: chaosLevel,
    onSettingsUpdateFromLoad: handleSettingsUpdateFromLoad,
    initialSavedStateFromApp: initialSavedStateForLogic,
    isAppReady: appReady,
  });

  const {
    currentTheme, 
    currentScene, mainQuest, currentObjective, actionOptions,
    inventory, gameLog, isLoading, error, lastActionLog, themeHistory, mapData, 
    currentMapNodeId, mapLayoutConfig,
    allCharacters, 
    score, freeFormActionText, setFreeFormActionText,
    handleFreeFormActionSubmit, objectiveAnimationType, handleActionSelect,
    handleItemInteraction, handleRetry, executeManualRealityShift,
    completeManualShiftWithSelectedTheme, 
    cancelManualShiftThemeSelection,    
    isAwaitingManualShiftThemeSelection, 
    startCustomGame, 
    gatherCurrentGameState, applyLoadedGameState, setError: setLogicError,
    setIsLoading: setLogicIsLoading, hasGameBeenInitialized, handleStartNewGameFromButton,
    localTime, localEnvironment, localPlace,
    dialogueState, 
    handleDialogueOptionSelect,
    handleForceExitDialogue,
    isDialogueExiting,
    lastDebugPacket,
    lastTurnChanges,
    turnsSinceLastShift,
    isCustomGameMode, 
    gameStateStack,
    handleMapLayoutConfigChange,
    loadingReason,
    handleUndoTurn,
    mapViewBox,
    handleMapViewBoxChange,
    handleMapNodesPositionChange,
  } = gameLogic;

  useEffect(() => {
    if (!isLoading) {
      clearProgress();
    }
  }, [isLoading, clearProgress]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevGameLogLength = useRef(gameLog.length);
  const prevSceneRef = useRef(currentScene);
  const autosaveTimeoutRef = useRef<number | null>(null);

  const [isVisualizerVisible, setIsVisualizerVisible] = useState(false);
  const [visualizerImageUrl, setVisualizerImageUrl] = useState<string | null>(null);
  const [visualizerImageScene, setVisualizerImageScene] = useState<string | null>(null);
  const [isKnowledgeBaseVisible, setIsKnowledgeBaseVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false); 
  const [userRequestedTitleMenuOpen, setUserRequestedTitleMenuOpen] = useState(false);
  const [isThemeMemoryVisible, setIsThemeMemoryVisible] = useState(false);
  const [isDebugViewVisible, setIsDebugViewVisible] = useState(false);
  const [isCustomGameSetupVisible, setIsCustomGameSetupVisible] = useState(false); 
  const [isManualShiftThemeSelectionVisible, setIsManualShiftThemeSelectionVisible] = useState(false); 

  const [shiftConfirmOpen, setShiftConfirmOpen] = useState(false);
  const [newGameFromMenuConfirmOpen, setNewGameFromMenuConfirmOpen] = useState(false);
  const [loadGameFromMenuConfirmOpen, setLoadGameFromMenuConfirmOpen] = useState(false);
  const [newCustomGameConfirmOpen, setNewCustomGameConfirmOpen] = useState(false); 

  const effectiveIsTitleMenuOpen = userRequestedTitleMenuOpen || (appReady && !hasGameBeenInitialized && !isLoading && !isCustomGameSetupVisible && !isManualShiftThemeSelectionVisible);
  
  const isAnyModalOrDialogueActive = isVisualizerVisible || isKnowledgeBaseVisible || isSettingsVisible || isInfoVisible || isMapVisible || isThemeMemoryVisible || isDebugViewVisible || !!dialogueState || effectiveIsTitleMenuOpen || shiftConfirmOpen || newGameFromMenuConfirmOpen || loadGameFromMenuConfirmOpen || isCustomGameSetupVisible || newCustomGameConfirmOpen || isManualShiftThemeSelectionVisible;


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
  }, [currentScene]);

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


  const handleSaveToFile = useCallback(() => {
    if (isLoading || !currentTheme || !!dialogueState) { 
      setLogicError("Cannot save to file while loading, in dialogue, or without an active game.");
      return;
    }
    const gameState = gatherCurrentGameState();
    saveGameStateToFile(gameState);
  }, [gatherCurrentGameState, isLoading, currentTheme, setLogicError, dialogueState]);

  const handleLoadFromFileClick = () => {
    if (isLoading || !!dialogueState) {
      setLogicError("Cannot load from file while another operation is in progress or while in dialogue.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading || !!dialogueState) {
      setLogicError("Cannot load from file while another operation is in progress or while in dialogue.");
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
      setLogicIsLoading(true);
      setLogicError(null);
      const loadedFullState = await loadGameStateFromFile(file);
      if (loadedFullState) {
        await applyLoadedGameState({ savedStateToLoad: loadedFullState });
        setUserRequestedTitleMenuOpen(false);
        setIsCustomGameSetupVisible(false); 
        setIsManualShiftThemeSelectionVisible(false); 
        saveGameStateToLocalStorage(loadedFullState);
      } else {
        setLogicError("Failed to load game from file. The file might be corrupted, an incompatible version, or not a valid save file. Current game remains unchanged.");
      }
      setLogicIsLoading(false);
    }
    event.target.value = '';
  };

  /**
   * Wrapper to satisfy lint rule by explicitly ignoring the returned Promise
   * from the async file handler.
   */
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileSelected(event);
  };

  const canPerformFreeAction = score >= FREE_FORM_ACTION_COST && !isLoading && hasGameBeenInitialized && !dialogueState;

  const setGeneratedImageCache = useCallback((url: string, scene: string) => {
    setVisualizerImageUrl(url);
    setVisualizerImageScene(scene);
  }, []);

  const confirmShift = () => {
    executeManualRealityShift(); 
    setShiftConfirmOpen(false);
  };

  useEffect(() => {
    if (isAwaitingManualShiftThemeSelection && !isManualShiftThemeSelectionVisible) {
      setIsManualShiftThemeSelectionVisible(true);
    }
  }, [isAwaitingManualShiftThemeSelection, isManualShiftThemeSelectionVisible]);

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

  const mapInitialViewBox = useMemo(() => {
    const parts = mapViewBox.split(' ').map(parseFloat);
    if (parts.length === 4) {
      const [, , vw, vh] = parts;
      const node = mapData.nodes.find(n => n.id === currentMapNodeId);
      if (node && !isNaN(vw) && !isNaN(vh)) {
        return `${node.position.x - vw / 2} ${node.position.y - vh / 2} ${vw} ${vh}`;
      }
    }
    return mapViewBox;
  }, [mapViewBox, mapData.nodes, currentMapNodeId]);


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
          <h1 className="text-4xl md:text-5xl font-bold text-sky-400 tracking-wider" style={{ fontFamily: "'Cinzel Decorative', cursive" }}>
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
              onRetry={isLoading ? undefined : handleRetry} 
            />
          </div>
        )}
         {error && !hasGameBeenInitialized && (
            <div className="w-full max-w-3xl my-4">
                <ErrorDisplay message={error} onRetry={handleRetry} />
            </div>
        )}

        <main className={`w-full max-w-screen-xl grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow ${(isAnyModalOrDialogueActive) ? 'filter blur-sm pointer-events-none' : ''}`}>
          <div className="lg:col-span-2 space-y-6">
            {hasGameBeenInitialized && (
              <MainToolbar
                score={score}
                isLoading={isLoading || !!dialogueState} 
                currentThemeName={currentTheme?.name || null}
                currentSceneExists={!!currentScene}
                onOpenInfo={() => setIsInfoVisible(true)}
                onOpenVisualizer={() => setIsVisualizerVisible(true)}
                onOpenKnowledgeBase={() => setIsKnowledgeBaseVisible(true)}
                onOpenThemeMemory={() => setIsThemeMemoryVisible(true)}
                onOpenMap={() => setIsMapVisible(true)} 
                onOpenTitleMenu={() => setUserRequestedTitleMenuOpen(true)}
                onManualRealityShift={() => setShiftConfirmOpen(true)}
                turnsSinceLastShift={turnsSinceLastShift}
              />
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
              mainQuest={hasGameBeenInitialized ? mainQuest : null}
              currentObjective={hasGameBeenInitialized ? currentObjective : null}
              lastActionLog={hasGameBeenInitialized ? lastActionLog : null}
              inventory={inventory}
              mapData={mapData.nodes} 
              allCharacters={allCharacters}
              currentThemeName={currentTheme?.name || null}
              objectiveAnimationType={objectiveAnimationType}
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
            <GameLogDisplay messages={gameLog} />
          </div>

          <div className="lg:col-span-2 space-y-6 flex flex-col">
            <InventoryDisplay
              items={inventory}
              onItemInteract={handleItemInteraction}
              onDiscardJunkItem={gameLogic.handleDiscardJunkItem}
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
      />

      <TitleMenu
        isVisible={effectiveIsTitleMenuOpen}
        onClose={() => setUserRequestedTitleMenuOpen(false)}
        onNewGame={handleNewGameFromMenu}
        onCustomGame={handleOpenCustomGameSetup} 
        onSaveGame={hasGameBeenInitialized ? handleSaveGameFromMenu : undefined}
        onLoadGame={handleLoadGameFromMenu}
        onOpenSettings={openSettingsFromMenu}
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
          <ThemeMemoryDisplay
            themeHistory={themeHistory}
            isVisible={isThemeMemoryVisible}
            onClose={() => setIsThemeMemoryVisible(false)}
          />
           <MapDisplay
            mapData={mapData} 
            currentThemeName={currentTheme?.name || null}
            currentMapNodeId={currentMapNodeId}
           initialLayoutConfig={mapLayoutConfig}
           initialViewBox={mapInitialViewBox}
            onNodesPositioned={handleMapNodesPositionChange}
           onLayoutConfigChange={handleMapLayoutConfigChange}
           onViewBoxChange={handleMapViewBoxChange}
            isVisible={isMapVisible}
            onClose={() => setIsMapVisible(false)}
          />
          <InfoDisplay
            isVisible={isInfoVisible}
            onClose={() => setIsInfoVisible(false)}
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
