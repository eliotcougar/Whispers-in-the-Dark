/**
 * @file useGameInitialization.ts
 * @description Hook containing helpers for loading and initializing games.
 */

import { useCallback } from 'react';
import {
  FullGameState,
  ThemePackName,
  LoadingReason,
  GameStateStack,
} from '../types';
import {
  executeAIMainTurn,
  parseAIResponse,
} from '../services/storyteller';
import { SYSTEM_INSTRUCTION } from '../services/storyteller/systemPrompt';
import { getThemesFromPacks } from '../themes';
import { PLAYER_HOLDER_ID } from '../constants';
import { findThemeByName } from '../utils/themeUtils';
import { isServerOrClientError, extractStatusFromError } from '../utils/aiErrorUtils';
import {
  getInitialGameStates,
  getInitialGameStatesWithSettings
} from '../utils/initialStates';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { getDefaultMapLayoutConfig } from './useMapUpdates';
import { buildInitialGamePrompt } from './initPromptHelpers';
import { DEFAULT_VIEWBOX } from '../constants';
import { ProcessAiResponseFn } from './useProcessAiResponse';
import { repairFeatureHierarchy } from '../utils/mapHierarchyUpgradeUtils';

export interface LoadInitialGameOptions {
  isRestart?: boolean;
  explicitThemeName?: string | null;
  isTransitioningFromShift?: boolean;
  customGameFlag?: boolean;
  savedStateToLoad?: GameStateStack | null;
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
  setGameStateStack: (stack: GameStateStack) => void;
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
    setGameStateStack,
    processAiResponse,
  } = props;


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
        const [currentSaved, previousSaved] = savedStateToLoad;
        let themeForLoadedState = currentSaved.currentThemeObject;
        if (!themeForLoadedState && currentSaved.currentThemeName) {
          themeForLoadedState = findThemeByName(currentSaved.currentThemeName);
        }
        if (currentSaved.currentThemeName && !themeForLoadedState) {
          setError(`Failed to apply loaded state: Theme "${currentSaved.currentThemeName}" not found. Game state may be unstable.`);
        }

        let mapDataToApply = currentSaved.mapData;
        if (themeForLoadedState) {
          mapDataToApply = await repairFeatureHierarchy(
            mapDataToApply,
            themeForLoadedState,
          );
        }
        const currentMapNodeIdToApply = currentSaved.currentMapNodeId;
        const destinationToApply = currentSaved.destinationNodeId;
        const mapLayoutConfigToApply = currentSaved.mapLayoutConfig;
        if (typeof mapLayoutConfigToApply.NESTED_PADDING !== 'number') {
          mapLayoutConfigToApply.NESTED_PADDING = getDefaultMapLayoutConfig().NESTED_PADDING;
        }
        if (typeof mapLayoutConfigToApply.NESTED_ANGLE_PADDING !== 'number') {
          mapLayoutConfigToApply.NESTED_ANGLE_PADDING = getDefaultMapLayoutConfig().NESTED_ANGLE_PADDING;
        }

        const stateWithMapData = {
          ...currentSaved,
          currentThemeObject: themeForLoadedState,
          mapData: mapDataToApply,
          currentMapNodeId: currentMapNodeIdToApply,
          destinationNodeId: destinationToApply,
          mapLayoutConfig: mapLayoutConfigToApply,
          mapViewBox: currentSaved.mapViewBox,
          isCustomGameMode: currentSaved.isCustomGameMode,
          isAwaitingManualShiftThemeSelection: currentSaved.isAwaitingManualShiftThemeSelection,
          globalTurnNumber: currentSaved.globalTurnNumber,
        } as FullGameState;

        setGameStateStack([stateWithMapData, previousSaved ?? stateWithMapData]);

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
        draftState.allNPCs = previousState.allNPCs.filter((npc) => npc.themeName !== themeObjToLoad.name);
      } else {
        draftState.mapData = { nodes: [], edges: [] };
        draftState.allNPCs = [];
        draftState.themeHistory = {};
        draftState.score = 0;
        draftState.inventory = [];
        draftState.mapViewBox = DEFAULT_VIEWBOX;
      }

      const baseStateSnapshotForInitialTurn = structuredCloneGameState(draftState);
      const hasExistingHistory = Object.prototype.hasOwnProperty.call(
        draftState.themeHistory,
        themeObjToLoad.name
      );
      const prompt = buildInitialGamePrompt({
        theme: themeObjToLoad,
        inventory: draftState.inventory,
        playerGender: playerGenderProp,
        isTransitioningFromShift,
        themeMemory: hasExistingHistory ? draftState.themeHistory[themeObjToLoad.name] : undefined,
        mapDataForTheme: draftState.mapData,
        npcsForTheme: draftState.allNPCs.filter(npc => npc.themeName === themeObjToLoad.name),
      });
      const systemInstructionForCall = themeObjToLoad.systemInstructionModifier
        ? `${SYSTEM_INSTRUCTION}\n\nCURRENT THEME GUIDANCE:\n${themeObjToLoad.systemInstructionModifier}`
        : SYSTEM_INSTRUCTION;
      draftState.lastDebugPacket = {
        prompt,
        systemInstruction: systemInstructionForCall,
        jsonSchema: undefined,
        rawResponseText: null,
        parsedResponse: null,
        timestamp: new Date().toISOString(),
        storytellerThoughts: null,
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
        loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null },
        dialogueDebugInfo: null,
      };

      try {
        const {
          response,
          thoughts,
          systemInstructionUsed,
          jsonSchemaUsed,
        } = await executeAIMainTurn(
          prompt,
          themeObjToLoad.systemInstructionModifier,
        );
        draftState.lastDebugPacket.rawResponseText = response.text ?? null;
        draftState.lastDebugPacket.storytellerThoughts = thoughts;
        draftState.lastDebugPacket.systemInstruction = systemInstructionUsed;
        draftState.lastDebugPacket.jsonSchema = jsonSchemaUsed;

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
          draftState.allNPCs.filter((npc) => npc.themeName === themeObjToLoad.name),
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
      } catch (e: unknown) {
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
      setGameStateStack,
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
    const systemInstructionForCall = currentThemeObj.systemInstructionModifier
      ? `${SYSTEM_INSTRUCTION}\n\nCURRENT THEME GUIDANCE:\n${currentThemeObj.systemInstructionModifier}`
      : SYSTEM_INSTRUCTION;
    const debugPacket = {
      prompt: lastPrompt,
      systemInstruction: systemInstructionForCall,
      jsonSchema: undefined,
      rawResponseText: null,
      parsedResponse: null,
      timestamp: new Date().toISOString(),
      storytellerThoughts: null,
      mapUpdateDebugInfo: null,
      inventoryDebugInfo: null,
      loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null },
      dialogueDebugInfo: null,
    };
    draftState.lastDebugPacket = debugPacket;

    try {
      const {
        response,
        thoughts,
        systemInstructionUsed,
        jsonSchemaUsed,
      } = await executeAIMainTurn(
        lastPrompt,
        currentThemeObj.systemInstructionModifier,
      );
      draftState.lastDebugPacket.rawResponseText = response.text ?? null;
      draftState.lastDebugPacket.storytellerThoughts = thoughts;
      draftState.lastDebugPacket.systemInstruction = systemInstructionUsed;
      draftState.lastDebugPacket.jsonSchema = jsonSchemaUsed;

      const currentThemeNPCs = draftState.allNPCs.filter(
        (npc) => npc.themeName === currentThemeObj.name,
      );
      const currentThemeMapDataForParse = {
        nodes: draftState.mapData.nodes.filter(
          (node) => node.themeName === currentThemeObj.name,
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
        currentThemeNPCs,
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
    } catch (e: unknown) {
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
    loadInitialGame,
    handleStartNewGameFromButton,
    startCustomGame,
    executeRestartGame,
    handleRetry,
  };
};
