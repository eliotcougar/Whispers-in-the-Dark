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
import {
  executeAIMainTurn,
  parseAIResponse,
  buildNewGameFirstTurnPrompt,
  buildNewThemePostShiftPrompt,
  buildReturnToThemePostShiftPrompt
} from '../services/storyteller';
import { getThemesFromPacks } from '../themes';
import { CURRENT_SAVE_GAME_VERSION, PLAYER_HOLDER_ID } from '../constants';
import { findThemeByName } from '../utils/themeUtils';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';
import {
  getInitialGameStates,
  getInitialGameStatesWithSettings
} from '../utils/initialStates';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { getDefaultMapLayoutConfig } from './useMapUpdates';
import { DEFAULT_VIEWBOX } from '../constants';
import { ProcessAiResponseFn } from './useProcessAiResponse';

export interface LoadInitialGameOptions {
  isRestart?: boolean;
  explicitThemeName?: string | null;
  isTransitioningFromShift?: boolean;
  customGameFlag?: boolean;
  savedStateToLoad?: FullGameState | null;
}

export interface UseGameInitializationProps {
  playerGenderProp: string;
  enabledThemePacksProp: Array<ThemePackName>;
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
        mapData: currentFullState.mapData,
        currentMapNodeId: currentFullState.currentMapNodeId,
        destinationNodeId: currentFullState.destinationNodeId,
        mapLayoutConfig: currentFullState.mapLayoutConfig,
        mapViewBox: currentFullState.mapViewBox,
        isCustomGameMode: currentFullState.isCustomGameMode,
        isAwaitingManualShiftThemeSelection: currentFullState.isAwaitingManualShiftThemeSelection,
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

        const mapDataToApply = savedStateToLoad.mapData;
        const currentMapNodeIdToApply = savedStateToLoad.currentMapNodeId;
        const destinationToApply = savedStateToLoad.destinationNodeId;
        const mapLayoutConfigToApply = savedStateToLoad.mapLayoutConfig;
        if (typeof mapLayoutConfigToApply.NESTED_PADDING !== 'number') {
          mapLayoutConfigToApply.NESTED_PADDING = getDefaultMapLayoutConfig().NESTED_PADDING;
        }
        if (typeof mapLayoutConfigToApply.NESTED_ANGLE_PADDING !== 'number') {
          mapLayoutConfigToApply.NESTED_ANGLE_PADDING = getDefaultMapLayoutConfig().NESTED_ANGLE_PADDING;
        }

        const stateWithMapData = {
          ...savedStateToLoad,
          currentThemeObject: themeForLoadedState,
          mapData: mapDataToApply,
          currentMapNodeId: currentMapNodeIdToApply,
          destinationNodeId: destinationToApply,
          mapLayoutConfig: mapLayoutConfigToApply,
          mapViewBox: savedStateToLoad.mapViewBox,
          isCustomGameMode: savedStateToLoad.isCustomGameMode,
          isAwaitingManualShiftThemeSelection: savedStateToLoad.isAwaitingManualShiftThemeSelection,
          globalTurnNumber: savedStateToLoad.globalTurnNumber,
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
      draftState.mapViewBox = DEFAULT_VIEWBOX;
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
        draftState.mapViewBox = previousState.mapViewBox;
        draftState.globalTurnNumber = previousState.globalTurnNumber;

        draftState.mapData.nodes = previousState.mapData.nodes.filter((n) => n.themeName !== themeObjToLoad.name);
          draftState.mapData.edges = previousState.mapData.edges.filter((e) => {
            const sourceNode = previousState.mapData.nodes.find((n) => n.id === e.sourceNodeId);
            const targetNode = previousState.mapData.nodes.find((n) => n.id === e.targetNodeId);
            return (
              (sourceNode?.themeName !== themeObjToLoad.name) ||
              (targetNode?.themeName !== themeObjToLoad.name)
            );
          });
        draftState.allCharacters = previousState.allCharacters.filter((c) => c.themeName !== themeObjToLoad.name);
      } else {
        draftState.mapData = { nodes: [], edges: [] };
        draftState.allCharacters = [];
        draftState.themeHistory = {};
        draftState.score = 0;
        draftState.inventory = [];
        draftState.mapViewBox = DEFAULT_VIEWBOX;
      }

      const baseStateSnapshotForInitialTurn = structuredCloneGameState(draftState);
      let prompt = '';
      const hasExistingHistory = Object.prototype.hasOwnProperty.call(
        draftState.themeHistory,
        themeObjToLoad.name
      );
      if (isTransitioningFromShift && hasExistingHistory) {
        const currentThemeCharacters = draftState.allCharacters.filter((c) => c.themeName === themeObjToLoad.name);
        prompt = buildReturnToThemePostShiftPrompt(
          themeObjToLoad,
          draftState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
          playerGenderProp,
          draftState.themeHistory[themeObjToLoad.name],
          draftState.mapData,
          currentThemeCharacters
        );
      } else if (isTransitioningFromShift) {
        prompt = buildNewThemePostShiftPrompt(
          themeObjToLoad,
          draftState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
          playerGenderProp
        );
      } else {
        prompt = buildNewGameFirstTurnPrompt(themeObjToLoad, playerGenderProp);
      }
      draftState.lastDebugPacket = {
        prompt,
        rawResponseText: null,
        parsedResponse: null,
        timestamp: new Date().toISOString(),
        storytellerThoughts: null,
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
        dialogueDebugInfo: null,
      };

      try {
        const { response, thoughts } = await executeAIMainTurn(
          prompt,
          themeObjToLoad.systemInstructionModifier,
        );
        draftState.lastDebugPacket.rawResponseText = response.text ?? null;
        draftState.lastDebugPacket.storytellerThoughts = thoughts;

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
          () => { setParseErrorCounter(1); },
          undefined,
          undefined,
          draftState.allCharacters.filter((c) => c.themeName === themeObjToLoad.name),
          currentThemeMapDataForParse,
          draftState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID)
        );

        await processAiResponse(parsedData, themeObjToLoad, draftState, {
          baseStateSnapshot: baseStateSnapshotForInitialTurn,
          forceEmptyInventory: !isTransitioningFromShift && isRestart,
          playerActionText: undefined,
        });


        setHasGameBeenInitialized(true);
        draftState.pendingNewThemeNameAfterShift = null;
        if (!isTransitioningFromShift || draftState.globalTurnNumber === 0) {
          draftState.globalTurnNumber = 1;
        }
      } catch (e) {
        console.error('Error loading initial game:', e);
          if (isServerOrClientError(e)) {
            draftState = structuredCloneGameState(baseStateSnapshotForInitialTurn);
            const status = extractStatusFromError(e);
            setError(`AI service error (${String(status ?? 'unknown')}). Please retry.`);
          } else {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`Failed to initialize the adventure in "${themeObjToLoad.name}": ${errorMessage}`);
          }
        if (draftState.lastDebugPacket) {
          draftState.lastDebugPacket.error = e instanceof Error ? e.message : String(e);
        }
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
    void loadInitialGame({ isRestart: true, customGameFlag: false });
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
      void loadInitialGame({ explicitThemeName: themeName, isRestart: true, customGameFlag: true });
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
    void loadInitialGame({ isRestart: true, customGameFlag: false });
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
  const handleRetry = useCallback(async () => {
    setError(null);
    const currentFullState = getCurrentGameState();

    // If no theme has been initialized yet, retry initial load
    if (!currentFullState.currentThemeName) {
      await loadInitialGame({
        isRestart: true,
        customGameFlag: currentFullState.isCustomGameMode,
      });
      return;
    }

    const lastPrompt = currentFullState.lastDebugPacket?.prompt;
    const currentThemeObj = currentFullState.currentThemeObject;

    // Fallback to generic retry if prompt or theme data is missing
    if (!lastPrompt || !currentThemeObj) {
      const genericRetryState = {
        ...currentFullState,
        actionOptions: [
          'Look around.',
          'Ponder the situation.',
          'Try to move on.',
          'Check your inventory.',
          'Consider your objective.',
          'Plan your next steps.'
        ],
        lastActionLog: 'Attempting to re-establish connection with the narrative flow...',
        dialogueState: null,
      } as FullGameState;
      commitGameState(genericRetryState);
      setIsLoading(false);
      setLoadingReason(null);
      return;
    }

    setIsLoading(true);
    setLoadingReason('storyteller');
    setParseErrorCounter(0);

    const baseStateSnapshot = structuredCloneGameState(currentFullState);
    let draftState = structuredCloneGameState(currentFullState);
    const debugPacket = {
      prompt: lastPrompt,
      rawResponseText: null,
      parsedResponse: null,
      timestamp: new Date().toISOString(),
      storytellerThoughts: null,
      mapUpdateDebugInfo: null,
      inventoryDebugInfo: null,
      dialogueDebugInfo: null,
    };
    draftState.lastDebugPacket = debugPacket;

    try {
      const { response, thoughts } = await executeAIMainTurn(
        lastPrompt,
        currentThemeObj.systemInstructionModifier,
      );
      draftState.lastDebugPacket.rawResponseText = response.text ?? null;
      draftState.lastDebugPacket.storytellerThoughts = thoughts;

      const currentThemeCharacters = draftState.allCharacters.filter(
        (c) => c.themeName === currentThemeObj.name,
      );
      const currentThemeMapDataForParse = {
        nodes: draftState.mapData.nodes.filter(
          (n) => n.themeName === currentThemeObj.name,
        ),
        edges: draftState.mapData.edges.filter((e) => {
          const sourceNode = draftState.mapData.nodes.find(
            (node) => node.id === e.sourceNodeId,
          );
          const targetNode = draftState.mapData.nodes.find(
            (node) => node.id === e.targetNodeId,
          );
          return (
            sourceNode?.themeName === currentThemeObj.name &&
            targetNode?.themeName === currentThemeObj.name
          );
        }),
      };

      const parsedData = await parseAIResponse(
        response.text ?? '',
        playerGenderProp,
        currentThemeObj,
        () => { setParseErrorCounter(1); },
        currentFullState.lastActionLog ?? undefined,
        currentFullState.currentScene,
        currentThemeCharacters,
        currentThemeMapDataForParse,
        currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
      );

      await processAiResponse(parsedData, currentThemeObj, draftState, {
        baseStateSnapshot,
        scoreChangeFromAction: 0,
        playerActionText: undefined,
      });

      draftState.turnsSinceLastShift += 1;
      draftState.globalTurnNumber += 1;
    } catch (e) {
      console.error('Error retrying last main AI request:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(`Retry failed: ${errMsg}.`);
      draftState = structuredCloneGameState(baseStateSnapshot);
      draftState.lastActionLog =
        'Retry failed. The outcome remains uncertain.';
      draftState.actionOptions = [
        'Look around.',
        'Ponder the situation.',
        'Check your inventory.',
        'Try to move on.',
        'Consider your objective.',
        'Plan your next steps.'
      ];
      draftState.dialogueState = null;
      if (draftState.lastDebugPacket) draftState.lastDebugPacket.error = errMsg;
    } finally {
      commitGameState(draftState);
      setIsLoading(false);
      setLoadingReason(null);
    }
  }, [
    getCurrentGameState,
    loadInitialGame,
    commitGameState,
    setError,
    setIsLoading,
    setLoadingReason,
    setParseErrorCounter,
    processAiResponse,
    playerGenderProp,
  ]);

  return {
    gatherCurrentGameStateForSave,
    loadInitialGame,
    handleStartNewGameFromButton,
    startCustomGame,
    executeRestartGame,
    handleRetry,
  };
};
