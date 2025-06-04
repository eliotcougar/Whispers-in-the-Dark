/**
 * @file useGameInitialization.ts
 * @description Hook containing helpers for loading and initializing games.
 */

import { useCallback } from 'react';
import {
  FullGameState,
  ThemePackName,
  LoadingReason,
} from '../types';
import { executeAIMainTurn } from '../services/gameAIService';
import { parseAIResponse } from '../services/aiResponseParser';
import { getThemesFromPacks } from '../themes';
import { CURRENT_SAVE_GAME_VERSION } from '../constants';
import { findThemeByName } from '../services/themeUtils';
import { fetchMapHierarchyFromLocation_Service } from '../services/mapHierarchyService';
import {
  formatNewGameFirstTurnPrompt,
  formatNewThemePostShiftPrompt,
  formatReturnToThemePostShiftPrompt,
} from '../utils/promptFormatters/dialogue';
import {
  getInitialGameStates,
  getInitialGameStatesWithSettings
} from '../utils/initialStates';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { getDefaultMapLayoutConfig } from './useMapUpdates';
import { ProcessAiResponseFn } from './usePlayerActions';

export interface LoadInitialGameOptions {
  isRestart?: boolean;
  explicitThemeName?: string | null;
  isTransitioningFromShift?: boolean;
  customGameFlag?: boolean;
  savedStateToLoad?: FullGameState | null;
}

export interface UseGameInitializationProps {
  playerGenderProp: string;
  enabledThemePacksProp: ThemePackName[];
  stabilityLevelProp: number;
  chaosLevelProp: number;
  setIsLoading: (val: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
  setParseErrorCounter: (val: number) => void;
  setHasGameBeenInitialized: (val: boolean) => void;
  onSettingsUpdateFromLoad: (
    loaded: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks' | 'stabilityLevel' | 'chaosLevel'>>
  ) => void;
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  resetGameStateStack: (state: FullGameState) => void;
  processAiResponse: ProcessAiResponseFn;
}

/**
 * Provides functions for starting new games and saving/loading state.
 */
export const useGameInitialization = (props: UseGameInitializationProps) => {
  const {
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
    processAiResponse,
  } = props;

  /** Returns a snapshot of the current game state suitable for saving. */
  const gatherCurrentGameStateForSave = useCallback((): FullGameState => {
    const currentFullState = getCurrentGameState();
    return {
      ...currentFullState,
      saveGameVersion: CURRENT_SAVE_GAME_VERSION,
      playerGender: playerGenderProp,
      enabledThemePacks: enabledThemePacksProp,
      stabilityLevel: stabilityLevelProp,
      chaosLevel: chaosLevelProp,
      mapData: currentFullState.mapData || { nodes: [], edges: [] },
      currentMapNodeId: currentFullState.currentMapNodeId || null,
      mapLayoutConfig: currentFullState.mapLayoutConfig || getDefaultMapLayoutConfig(),
      isCustomGameMode: currentFullState.isCustomGameMode ?? false,
      isAwaitingManualShiftThemeSelection: currentFullState.isAwaitingManualShiftThemeSelection ?? false,
      globalTurnNumber: currentFullState.globalTurnNumber,
      currentThemeObject: currentFullState.currentThemeObject,
    };
  }, [
    getCurrentGameState,
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
  ]);

  /**
   * Loads the initial game state or applies a saved state to the game.
   */
  const loadInitialGame = useCallback(
    async (options: LoadInitialGameOptions = {}) => {
      const {
        isRestart = false,
        explicitThemeName = null,
        isTransitioningFromShift = false,
        customGameFlag = false,
        savedStateToLoad = null,
      } = options;

      setIsLoading(true);
      setLoadingReason(isTransitioningFromShift ? 'reality_shift_load' : 'initial_load');
      setError(null);
      setParseErrorCounter(0);

      if (savedStateToLoad) {
        let themeForLoadedState = savedStateToLoad.currentThemeObject;
        if (!themeForLoadedState && savedStateToLoad.currentThemeName) {
          themeForLoadedState = findThemeByName(savedStateToLoad.currentThemeName);
        }
        if (savedStateToLoad.currentThemeName && !themeForLoadedState) {
          setError(`Failed to apply loaded state: Theme "${savedStateToLoad.currentThemeName}" not found. Game state may be unstable.`);
        }

        const mapDataToApply = savedStateToLoad.mapData || { nodes: [], edges: [] };
        const currentMapNodeIdToApply = savedStateToLoad.currentMapNodeId || null;
        const mapLayoutConfigToApply = savedStateToLoad.mapLayoutConfig || getDefaultMapLayoutConfig();
        if (!mapLayoutConfigToApply.K_EDGE_NODE_REPULSION) {
          mapLayoutConfigToApply.K_EDGE_NODE_REPULSION = getDefaultMapLayoutConfig().K_EDGE_NODE_REPULSION;
        }

        const stateWithMapData = {
          ...savedStateToLoad,
          currentThemeObject: themeForLoadedState,
          mapData: mapDataToApply,
          currentMapNodeId: currentMapNodeIdToApply,
          mapLayoutConfig: mapLayoutConfigToApply,
          isCustomGameMode: savedStateToLoad.isCustomGameMode ?? false,
          isAwaitingManualShiftThemeSelection: savedStateToLoad.isAwaitingManualShiftThemeSelection ?? false,
          globalTurnNumber: savedStateToLoad.globalTurnNumber ?? 0,
        } as FullGameState;

        commitGameState(stateWithMapData);

        onSettingsUpdateFromLoad({
          stabilityLevel: stateWithMapData.stabilityLevel,
          chaosLevel: stateWithMapData.chaosLevel,
          enabledThemePacks: stateWithMapData.enabledThemePacks,
          playerGender: stateWithMapData.playerGender,
        });

        setHasGameBeenInitialized(true);
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }

      let themeNameToLoad = explicitThemeName;
      if (!themeNameToLoad) {
        const availableThemes = getThemesFromPacks(enabledThemePacksProp);
        if (availableThemes.length === 0) {
          setError('No adventure themes are enabled or available. Please check settings.');
          setIsLoading(false);
          setLoadingReason(null);
          return;
        }
        themeNameToLoad = availableThemes[Math.floor(Math.random() * availableThemes.length)].name;
      }

      const themeObjToLoad = findThemeByName(themeNameToLoad);
      if (!themeObjToLoad) {
        setError(`Theme "${themeNameToLoad}" not found. Cannot start game.`);
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }

      let draftState = getInitialGameStates();
      draftState.playerGender = playerGenderProp;
      draftState.enabledThemePacks = enabledThemePacksProp;
      draftState.stabilityLevel = stabilityLevelProp;
      draftState.chaosLevel = chaosLevelProp;
      draftState.mapLayoutConfig = getDefaultMapLayoutConfig();
      draftState.globalTurnNumber = 0;

      draftState.isCustomGameMode = customGameFlag;
      draftState.currentThemeName = themeObjToLoad.name;
      draftState.currentThemeObject = themeObjToLoad;
      draftState.turnsSinceLastShift = 0;

      if (isTransitioningFromShift) {
        const previousState = getCurrentGameState();
        draftState.inventory = previousState.inventory;
        draftState.score = previousState.score;
        draftState.themeHistory = previousState.themeHistory;
        draftState.mapLayoutConfig = previousState.mapLayoutConfig;
        draftState.globalTurnNumber = previousState.globalTurnNumber;

        draftState.mapData.nodes = previousState.mapData.nodes.filter((n) => n.themeName !== themeObjToLoad.name);
        draftState.mapData.edges = previousState.mapData.edges.filter((e) => {
          const sourceNode = previousState.mapData.nodes.find((n) => n.id === e.sourceNodeId);
          const targetNode = previousState.mapData.nodes.find((n) => n.id === e.targetNodeId);
          return (sourceNode && sourceNode.themeName !== themeObjToLoad.name) || (targetNode && targetNode.themeName !== themeObjToLoad.name);
        });
        draftState.allCharacters = previousState.allCharacters.filter((c) => c.themeName !== themeObjToLoad.name);
      } else {
        draftState.mapData = { nodes: [], edges: [] };
        draftState.allCharacters = [];
        draftState.themeHistory = {};
        draftState.score = 0;
        draftState.inventory = [];
      }

      const baseStateSnapshotForInitialTurn = structuredCloneGameState(draftState);
      let prompt = '';
      if (isTransitioningFromShift && draftState.themeHistory[themeObjToLoad.name]) {
        const currentThemeMainMapNodes = draftState.mapData.nodes.filter((n) => n.themeName === themeObjToLoad.name && !n.data.isLeaf);
        const currentThemeCharacters = draftState.allCharacters.filter((c) => c.themeName === themeObjToLoad.name);
        prompt = formatReturnToThemePostShiftPrompt(
          themeObjToLoad,
          draftState.inventory,
          playerGenderProp,
          draftState.themeHistory[themeObjToLoad.name],
          draftState.mapData,
          currentThemeCharacters
        );
      } else if (isTransitioningFromShift) {
        prompt = formatNewThemePostShiftPrompt(themeObjToLoad, draftState.inventory, playerGenderProp);
      } else {
        prompt = formatNewGameFirstTurnPrompt(themeObjToLoad, playerGenderProp);
      }
      draftState.lastDebugPacket = { prompt, rawResponseText: null, parsedResponse: null, timestamp: new Date().toISOString() };

      try {
        const response = await executeAIMainTurn(prompt, themeObjToLoad.systemInstructionModifier);
        if (draftState.lastDebugPacket) draftState.lastDebugPacket.rawResponseText = response.text ?? null;

        const currentThemeMapDataForParse = {
          nodes: draftState.mapData.nodes.filter((n) => n.themeName === themeObjToLoad.name),
          edges: draftState.mapData.edges.filter((e) => {
            const sourceNode = draftState.mapData.nodes.find((node) => node.id === e.sourceNodeId);
            const targetNode = draftState.mapData.nodes.find((node) => node.id === e.targetNodeId);
            return sourceNode?.themeName === themeObjToLoad.name && targetNode?.themeName === themeObjToLoad.name;
          }),
        };
        const parsedData = await parseAIResponse(
          response.text ?? '',
          playerGenderProp,
          themeObjToLoad,
          () => setParseErrorCounter(1),
          undefined,
          undefined,
          draftState.allCharacters.filter((c) => c.themeName === themeObjToLoad.name),
          currentThemeMapDataForParse,
          draftState.inventory
        );

        await processAiResponse(parsedData, themeObjToLoad, draftState, {
          baseStateSnapshot: baseStateSnapshotForInitialTurn,
          forceEmptyInventory: !isTransitioningFromShift && isRestart,
        });

        if (!isTransitioningFromShift && !draftState.themeHistory[themeObjToLoad.name]) {
          const hierarchy = await fetchMapHierarchyFromLocation_Service(
            draftState.localPlace,
            draftState.currentScene,
            themeObjToLoad
          );
          if (hierarchy) {
            hierarchy.nodes.forEach(n => {
              if (!draftState.mapData.nodes.some(ex => ex.placeName === n.placeName && ex.themeName === n.themeName)) {
                draftState.mapData.nodes.push(n);
              }
            });
            hierarchy.edges.forEach(e => {
              if (!draftState.mapData.edges.some(ex => ex.sourceNodeId === e.sourceNodeId && ex.targetNodeId === e.targetNodeId && ex.data.type === e.data.type)) {
                draftState.mapData.edges.push(e);
              }
            });
          }
        }

        setHasGameBeenInitialized(true);
        draftState.pendingNewThemeNameAfterShift = null;
        if (!isTransitioningFromShift || draftState.globalTurnNumber === 0) {
          draftState.globalTurnNumber = 1;
        }
      } catch (e: any) {
        console.error('Error loading initial game:', e);
        setError(`Failed to initialize the adventure in "${themeObjToLoad.name}": ${e.message || 'Unknown AI error'}`);
        if (draftState.lastDebugPacket) draftState.lastDebugPacket.error = e.message || String(e);
      } finally {
        commitGameState(draftState);
        setIsLoading(false);
        setLoadingReason(null);
      }
    }, [
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
      processAiResponse,
    ]);

  /**
   * Starts a completely new game.
   * The current state is cleared immediately so the UI does not display stale
   * information while the initial turn is loading.
   */
  const handleStartNewGameFromButton = useCallback(() => {
    const blankState = getInitialGameStatesWithSettings(
      playerGenderProp,
      enabledThemePacksProp,
      stabilityLevelProp,
      chaosLevelProp
    );
    resetGameStateStack(blankState);
    setHasGameBeenInitialized(false);
    loadInitialGame({ isRestart: true, customGameFlag: false });
  }, [
    loadInitialGame,
    setHasGameBeenInitialized,
    resetGameStateStack,
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
  ]);

  /** Starts a custom game using the provided theme name. */
  const startCustomGame = useCallback(
    (themeName: string) => {
      const blankState = getInitialGameStatesWithSettings(
        playerGenderProp,
        enabledThemePacksProp,
        stabilityLevelProp,
        chaosLevelProp
      );
      resetGameStateStack(blankState);
      setHasGameBeenInitialized(false);
      loadInitialGame({ explicitThemeName: themeName, isRestart: true, customGameFlag: true });
    },
    [
      loadInitialGame,
      setHasGameBeenInitialized,
      resetGameStateStack,
      playerGenderProp,
      enabledThemePacksProp,
      stabilityLevelProp,
      chaosLevelProp,
    ]
  );

  /** Restarts the game from scratch. */
  const executeRestartGame = useCallback(() => {
    setError(null);
    const blankState = getInitialGameStatesWithSettings(
      playerGenderProp,
      enabledThemePacksProp,
      stabilityLevelProp,
      chaosLevelProp
    );
    resetGameStateStack(blankState);
    setHasGameBeenInitialized(false);
    loadInitialGame({ isRestart: true, customGameFlag: false });
  }, [
    loadInitialGame,
    setError,
    setHasGameBeenInitialized,
    resetGameStateStack,
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
  ]);

  /** Retry helper used when an error occurred in the main logic. */
  const handleRetry = useCallback(() => {
    setError(null);
    const currentFullState = getCurrentGameState();
    if (!currentFullState.currentThemeName) {
      loadInitialGame({ isRestart: true, customGameFlag: currentFullState.isCustomGameMode ?? false });
    } else {
      const genericRetryState = {
        ...currentFullState,
        actionOptions: ['Look around.', 'Ponder the situation.', 'Try to move on.', 'Check your inventory.'],
        lastActionLog: 'Attempting to re-establish connection with the narrative flow...',
        dialogueState: null,
      } as FullGameState;
      commitGameState(genericRetryState);
      setIsLoading(false);
      setLoadingReason(null);
    }
  }, [getCurrentGameState, loadInitialGame, commitGameState, setError, setIsLoading, setLoadingReason]);

  return {
    gatherCurrentGameStateForSave,
    loadInitialGame,
    handleStartNewGameFromButton,
    startCustomGame,
    executeRestartGame,
    handleRetry,
  };
};
