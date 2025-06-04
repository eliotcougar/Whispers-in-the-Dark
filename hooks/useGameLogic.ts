
/**
 * @file useGameLogic.ts
 * @description This hook encapsulates the core game logic for "Whispers in the Dark".
 * It manages the game state, player actions, AI interactions (storytelling, dialogue, corrections),
 * reality shifts, theme transitions, and overall game flow. It leverages various services
 * for AI communication, data parsing, and persistence.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    GameStateFromAI, Item, KnownUse, AdventureTheme,
    ThemeHistoryState, ItemChange, Character,
    ThemePackName, DialogueHistoryEntry, DialogueSummaryResponse,
    ProcessedGameContext, DialogueSummaryContext,
    FullGameState, GameStateStack, SavedGameDataShape,
    TurnChanges, ItemChangeRecord, ThemeMemory, DialogueData, DialogueSetupPayload,
    ValidNewCharacterPayload, ValidCharacterUpdatePayload, MapData, MapNode, MapLayoutConfig, MapEdge, AIMapUpdatePayload,
    LoadingReason, MapNodeData, MapEdgeData
} from '../types';
import {
    executeAIMainTurn,
    summarizeThemeAdventure_Service
} from '../services/gameAIService';
import {
    fetchCorrectedLocalPlace_Service,
    fetchCorrectedName_Service
} from '../services/correctionService';
import { parseAIResponse } from '../services/aiResponseParser';
import { getThemesFromPacks } from '../themes';
import {
  CURRENT_SAVE_GAME_VERSION,
  DEFAULT_PLAYER_GENDER,
  DEFAULT_ENABLED_THEME_PACKS,
  DEFAULT_STABILITY_LEVEL,
  DEFAULT_CHAOS_LEVEL,
  MAX_LOG_MESSAGES,
  FREE_FORM_ACTION_COST,
  RECENT_LOG_COUNT_FOR_PROMPT
} from '../constants';
import {
  findThemeByName,
} from '../services/saveLoadService';
import {
  addLogMessageToList,
  selectNextThemeName,
  buildItemChangeRecords,
  applyAllItemChanges,
  buildCharacterChangeRecords,
  applyAllCharacterChanges
} from '../utils/gameLogicUtils';
import {
    formatNewGameFirstTurnPrompt,
    formatNewThemePostShiftPrompt,
    formatReturnToThemePostShiftPrompt,
    formatMainGameTurnPrompt
} from '../utils/promptFormatters';
import { getInitialGameStates } from '../utils/initialStates';
import { useDialogueFlow } from './useDialogueFlow';
import { useRealityShift } from './useRealityShift';
import {
    DEFAULT_K_REPULSION, DEFAULT_K_SPRING, DEFAULT_IDEAL_EDGE_LENGTH,
    DEFAULT_K_CENTERING, DEFAULT_K_UNTANGLE, DEFAULT_K_EDGE_NODE_REPULSION,
    DEFAULT_DAMPING_FACTOR, DEFAULT_MAX_DISPLACEMENT, DEFAULT_LAYOUT_ITERATIONS
} from '../utils/mapLayoutUtils';
import { selectBestMatchingMapNode, attemptMatchAndSetNode } from '../utils/mapNodeMatcher';
import { handleMapUpdates } from '../utils/mapUpdateHandlers';


const OBJECTIVE_ANIMATION_DURATION = 5000;

export interface LoadInitialGameOptions {
  isRestart?: boolean;
  explicitThemeName?: string | null;
  isTransitioningFromShift?: boolean;
  customGameFlag?: boolean;
  savedStateToLoad?: FullGameState | null; 
}

interface ProcessAiResponseOptions {
  forceEmptyInventory?: boolean;
  baseStateSnapshot: FullGameState;
  isFromDialogueSummary?: boolean;
  scoreChangeFromAction?: number;
}

interface UseGameLogicProps {
  playerGenderProp: string;
  enabledThemePacksProp: ThemePackName[];
  stabilityLevelProp: number;
  chaosLevelProp: number;
  onSettingsUpdateFromLoad: (loadedSettings: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks' | 'stabilityLevel' | 'chaosLevel'>>) => void;
  initialSavedStateFromApp: FullGameState | null;
  isAppReady: boolean;
}

export interface DebugPacket {
  prompt: string;
  rawResponseText: string | null;
  parsedResponse: GameStateFromAI | DialogueSummaryResponse | null;
  error?: string;
  timestamp: string;
  mapUpdateDebugInfo?: {
    prompt: string;
    rawResponse?: string;
    parsedPayload?: AIMapUpdatePayload;
    validationError?: string;
  } | null;
  mapPruningDebugInfo?: { 
    pruningDebugInfo?: { chainsToRefineCount: number };
    refinementDebugInfo?: {
      prompt?: string;
      rawResponse?: string;
      parsedPayload?: AIMapUpdatePayload;
      validationError?: string;
    };
  } | null;
}

const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
    K_REPULSION: DEFAULT_K_REPULSION,
    K_SPRING: DEFAULT_K_SPRING,
    IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
    K_CENTERING: DEFAULT_K_CENTERING,
    K_UNTANGLE: DEFAULT_K_UNTANGLE,
    K_EDGE_NODE_REPULSION: DEFAULT_K_EDGE_NODE_REPULSION,
    DAMPING_FACTOR: DEFAULT_DAMPING_FACTOR,
    MAX_DISPLACEMENT: DEFAULT_MAX_DISPLACEMENT,
    iterations: DEFAULT_LAYOUT_ITERATIONS,
});

/**
 * Custom hook to manage the game's core logic and state.
 * It orchestrates player actions, AI interactions, reality shifts, dialogue, and map updates.
 *
 * @param {UseGameLogicProps} props - Configuration properties for the game logic, including player settings and initial state.
 * @returns An object containing the current game state variables (like scene, inventory, quests) and
 *          functions to interact with the game (like handling actions, items, dialogue, shifts).
 */
export const useGameLogic = (props: UseGameLogicProps) => {
  const {
    playerGenderProp,
    enabledThemePacksProp,
    stabilityLevelProp,
    chaosLevelProp,
    onSettingsUpdateFromLoad,
    initialSavedStateFromApp,
    isAppReady,
  } = props;

  const [gameStateStack, setGameStateStack] = useState<GameStateStack>(() => [getInitialGameStates(), getInitialGameStates()]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingReason, setLoadingReason] = useState<LoadingReason>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseErrorCounter, setParseErrorCounter] = useState<number>(0); 
  const [freeFormActionText, setFreeFormActionText] = useState<string>("");
  const [hasGameBeenInitialized, setHasGameBeenInitialized] = useState<boolean>(false);

  const objectiveAnimationClearTimerRef = useRef<number | null>(null);

  const getCurrentGameState = useCallback((): FullGameState => gameStateStack[0], [gameStateStack]);

  const commitGameState = useCallback((newGameState: FullGameState) => {
    setGameStateStack(prevStack => [newGameState, prevStack[0]]);
  }, []);

  const handleParseAttemptFailed = useCallback(() => {
    setParseErrorCounter(c => c + 1);
  }, []);

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
  }, [getCurrentGameState, playerGenderProp, enabledThemePacksProp, stabilityLevelProp, chaosLevelProp]);

  const processAiResponse = useCallback(async (
    aiData: GameStateFromAI | DialogueSummaryResponse | null,
    themeContextForResponse: AdventureTheme | null, 
    draftState: FullGameState,
    options: ProcessAiResponseOptions
  ): Promise<void> => {

    const { baseStateSnapshot, isFromDialogueSummary = false, scoreChangeFromAction = 0 } = options;

    const turnChanges: TurnChanges = {
        itemChanges: [], characterChanges: [], objectiveAchieved: false, objectiveTextChanged: false,
        mainQuestTextChanged: false, localTimeChanged: false, localEnvironmentChanged: false,
        localPlaceChanged: false, currentMapNodeIdChanged: false, scoreChangedBy: scoreChangeFromAction,
        mapDataChanged: false,
    };

    if (!aiData) {
      setError("The Dungeon Master's connection is unstable... (Invalid AI response after retries)");
      if (!isFromDialogueSummary && 'actionOptions' in draftState) {
        draftState.actionOptions = ["Try to wait for the connection to improve.", "Consult the ancient network spirits.", "Check your own connection.", "Sigh dramatically."];
      }
      draftState.lastActionLog = "The Dungeon Master seems to be having trouble communicating the outcome of your last action.";
      draftState.localTime = draftState.localTime ?? "Time Unknown";
      draftState.localEnvironment = draftState.localEnvironment ?? "Environment Undetermined";
      draftState.localPlace = draftState.localPlace ?? "Undetermined Location";
      draftState.lastTurnChanges = turnChanges;
      draftState.dialogueState = null;
      return;
    }

    draftState.lastDebugPacket = {
      prompt: draftState.lastDebugPacket?.prompt || "Prompt not captured for this state transition",
      rawResponseText: draftState.lastDebugPacket?.rawResponseText || "Raw text not captured",
      parsedResponse: aiData,
      timestamp: new Date().toISOString(),
      mapUpdateDebugInfo: null,
      mapPruningDebugInfo: null, 
    };

    if (aiData.localTime !== undefined) {
        if (draftState.localTime !== aiData.localTime) turnChanges.localTimeChanged = true;
        draftState.localTime = aiData.localTime;
    }
    if (aiData.localEnvironment !== undefined) {
        if (draftState.localEnvironment !== aiData.localEnvironment) turnChanges.localEnvironmentChanged = true;
        draftState.localEnvironment = aiData.localEnvironment;
    }
     if (aiData.localPlace !== undefined) {
        if (draftState.localPlace !== aiData.localPlace) turnChanges.localPlaceChanged = true;
        draftState.localPlace = aiData.localPlace;
    }

    if (aiData.mainQuest !== undefined) {
        if (draftState.mainQuest !== aiData.mainQuest) turnChanges.mainQuestTextChanged = true;
        draftState.mainQuest = aiData.mainQuest;
    }
    const oldObjectiveText = draftState.currentObjective;
    if (aiData.currentObjective !== undefined) {
        if (draftState.currentObjective !== aiData.currentObjective) turnChanges.objectiveTextChanged = true;
        draftState.currentObjective = aiData.currentObjective;
    }

    if (objectiveAnimationClearTimerRef.current) {
      clearTimeout(objectiveAnimationClearTimerRef.current);
      objectiveAnimationClearTimerRef.current = null;
    }
    let animationToSet: 'success' | 'neutral' | null = null;
    if (aiData.currentObjective !== undefined && aiData.currentObjective !== oldObjectiveText) {
      animationToSet = aiData.objectiveAchieved ? 'success' : 'neutral';
    } else if (aiData.objectiveAchieved && oldObjectiveText !== null) {
      animationToSet = 'success';
    }
    if (animationToSet) {
      draftState.objectiveAnimationType = animationToSet;
      objectiveAnimationClearTimerRef.current = window.setTimeout(() => {
        setGameStateStack(prev => [{...prev[0], objectiveAnimationType: null}, prev[1]]);
        objectiveAnimationClearTimerRef.current = null;
      }, OBJECTIVE_ANIMATION_DURATION);
    } else {
        draftState.objectiveAnimationType = null;
    }
    turnChanges.objectiveAchieved = aiData.objectiveAchieved || false;
    if (aiData.objectiveAchieved) {
        draftState.score = draftState.score + 1;
        turnChanges.scoreChangedBy += 1;
    }

    if ('sceneDescription' in aiData && aiData.sceneDescription) {
        draftState.currentScene = aiData.sceneDescription;
    }
    if ('options' in aiData && aiData.options && aiData.options.length > 0 && !('dialogueSetup' in aiData && aiData.dialogueSetup)) {
        draftState.actionOptions = aiData.options;
    } else if (!isFromDialogueSummary && !('dialogueSetup' in aiData && aiData.dialogueSetup)) {
        draftState.actionOptions = ["Look around.", "Ponder your situation.", "Check your inventory.", "Wait for something to happen."];
    }

    const aiItemChangesFromParser = aiData.itemChange || [];
    const correctedAndVerifiedItemChanges: ItemChange[] = [];
    if (themeContextForResponse) { 
        for (const change of aiItemChangesFromParser) {
            let currentChange = { ...change };
            if ((currentChange.action === 'lose' || currentChange.action === 'use') && typeof currentChange.item === 'string') {
                const itemNameFromAI = currentChange.item;
                const exactMatchInInventory = baseStateSnapshot.inventory.find(invItem => invItem.name === itemNameFromAI);
                if (!exactMatchInInventory) {
                    const originalLoadingReason = loadingReason; setLoadingReason('correction');
                    const correctedName = await fetchCorrectedName_Service(
                        "item", itemNameFromAI, aiData.logMessage, ('sceneDescription' in aiData ? aiData.sceneDescription : baseStateSnapshot.currentScene),
                        baseStateSnapshot.inventory.map(item => item.name),
                        themeContextForResponse
                    );
                    if (correctedName) currentChange.item = correctedName;
                    setLoadingReason(originalLoadingReason);
                }
            }
            correctedAndVerifiedItemChanges.push(currentChange);
        }
    } else {
        correctedAndVerifiedItemChanges.push(...aiItemChangesFromParser); 
    }
    turnChanges.itemChanges = buildItemChangeRecords(correctedAndVerifiedItemChanges, baseStateSnapshot.inventory);
    draftState.inventory = applyAllItemChanges(correctedAndVerifiedItemChanges, options.forceEmptyInventory ? [] : baseStateSnapshot.inventory);

    let mapAISuggestedNodeIdentifier: string | undefined = undefined;
    if (themeContextForResponse) {
        mapAISuggestedNodeIdentifier = await handleMapUpdates(
            aiData,
            draftState,
            baseStateSnapshot,
            themeContextForResponse,
            loadingReason,
            setLoadingReason,
            turnChanges
        );
    }

    if (aiData.logMessage) {
        if (isFromDialogueSummary) {
            draftState.gameLog = addLogMessageToList(draftState.gameLog, aiData.logMessage, MAX_LOG_MESSAGES);
        } else {
            draftState.gameLog = addLogMessageToList(draftState.gameLog, aiData.logMessage, MAX_LOG_MESSAGES);
        }
        draftState.lastActionLog = aiData.logMessage;
    } else if (!isFromDialogueSummary) {
        draftState.lastActionLog = "The Dungeon Master remains silent on the outcome of your last action.";
    }

    if ('dialogueSetup' in aiData && aiData.dialogueSetup) {
        draftState.actionOptions = [];
        draftState.dialogueState = {
            participants: aiData.dialogueSetup.participants,
            history: aiData.dialogueSetup.initialNpcResponses,
            options: aiData.dialogueSetup.initialPlayerOptions
        };
    } else if (isFromDialogueSummary) {
        draftState.dialogueState = null;
    }

    draftState.lastTurnChanges = turnChanges;
  }, [setGameStateStack, setError, loadingReason, setLoadingReason, playerGenderProp]); 

  const executePlayerAction = useCallback(async (action: string, isFreeForm: boolean = false) => {
    const currentFullState = getCurrentGameState();
    if (isLoading || currentFullState.dialogueState) return;

    setIsLoading(true); setLoadingReason('storyteller'); setError(null);
    setParseErrorCounter(0);
    setFreeFormActionText("");

    const baseStateSnapshot = JSON.parse(JSON.stringify(currentFullState)) as FullGameState;
    let scoreChangeFromAction = isFreeForm ? -FREE_FORM_ACTION_COST : 0;

    const currentThemeObj = currentFullState.currentThemeObject; 
    if (!currentThemeObj) {
        setError("Critical error: Current theme object not found. Cannot proceed.");
        setIsLoading(false); setLoadingReason(null); return;
    }

    const recentLogs = currentFullState.gameLog.slice(-RECENT_LOG_COUNT_FOR_PROMPT);
    const currentThemeMainMapNodes = currentFullState.mapData.nodes.filter(n => n.themeName === currentThemeObj.name && !n.data.isLeaf);
    const currentThemeCharacters = currentFullState.allCharacters.filter(c => c.themeName === currentThemeObj.name);
    const currentMapNodeDetails = currentFullState.currentMapNodeId ? currentFullState.mapData.nodes.find(n => n.id === currentFullState.currentMapNodeId) : null;

    const prompt = formatMainGameTurnPrompt(
        currentFullState.currentScene, action, currentFullState.inventory,
        currentFullState.mainQuest, currentFullState.currentObjective,
        currentThemeObj, recentLogs, currentThemeMainMapNodes, currentThemeCharacters,
        currentFullState.localTime, currentFullState.localEnvironment, currentFullState.localPlace,
        playerGenderProp, currentFullState.themeHistory, currentMapNodeDetails, currentFullState.mapData
    );

    let draftState = JSON.parse(JSON.stringify(currentFullState)) as FullGameState;
    draftState.lastDebugPacket = { prompt, rawResponseText: null, parsedResponse: null, timestamp: new Date().toISOString() };
    if (isFreeForm) draftState.score -= FREE_FORM_ACTION_COST;

    try {
        const response = await executeAIMainTurn(prompt, currentThemeObj.systemInstructionModifier);
        if (draftState.lastDebugPacket) draftState.lastDebugPacket.rawResponseText = response.text;

        const currentThemeMapDataForParse = {
            nodes: draftState.mapData.nodes.filter(n => n.themeName === currentThemeObj.name),
            edges: draftState.mapData.edges.filter(e => {
                const sourceNode = draftState.mapData.nodes.find(node => node.id === e.sourceNodeId);
                const targetNode = draftState.mapData.nodes.find(node => node.id === e.targetNodeId);
                return sourceNode?.themeName === currentThemeObj.name && targetNode?.themeName === currentThemeObj.name;
            })
        };

        const parsedData = await parseAIResponse(
            response.text, playerGenderProp, currentThemeObj, handleParseAttemptFailed,
            currentFullState.lastActionLog, currentFullState.currentScene,
            currentThemeCharacters,
            currentThemeMapDataForParse, currentFullState.inventory
        );

        await processAiResponse(parsedData, currentThemeObj, draftState, { baseStateSnapshot, scoreChangeFromAction });
    } catch (e: any) {
        console.error("Error executing player action:", e);
        setError(`The Dungeon Master's connection seems unstable. Error: (${e.message || "Unknown AI error"}). Please try again or consult the game log.`);
        draftState.lastActionLog = `Your action ("${action}") caused a ripple in reality, but the outcome is obscured.`;
        draftState.actionOptions = ["Look around.", "Ponder the situation.", "Check your inventory.", "Try to move on."];
        draftState.dialogueState = null;
        if (draftState.lastDebugPacket) draftState.lastDebugPacket.error = e.message || String(e);
    } finally {
        draftState.turnsSinceLastShift += 1;
        draftState.globalTurnNumber +=1;
        commitGameState(draftState);
        setIsLoading(false); setLoadingReason(null);

        if (!draftState.isCustomGameMode && !draftState.dialogueState && currentThemeObj) {
            const stabilityThreshold = currentThemeObj.name === draftState.pendingNewThemeNameAfterShift ? 0 : stabilityLevelProp;
            if (draftState.turnsSinceLastShift > stabilityThreshold && Math.random() * 100 < chaosLevelProp) {
                 setError("CHAOS SHIFT! Reality fractures without warning!");
                 triggerRealityShift(true);
             }
        }
    }
  }, [
    getCurrentGameState, commitGameState, isLoading, playerGenderProp, stabilityLevelProp, chaosLevelProp,
    handleParseAttemptFailed, processAiResponse, setIsLoading, setLoadingReason, setError
  ]);

  const loadInitialGame = useCallback(async (options: LoadInitialGameOptions = {}) => {
    const {
      isRestart = false,
      explicitThemeName = null,
      isTransitioningFromShift = false,
      customGameFlag = false,
      savedStateToLoad = null
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
          mapLayoutConfigToApply.K_EDGE_NODE_REPULSION = DEFAULT_K_EDGE_NODE_REPULSION;
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
      };

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
        setError("No adventure themes are enabled or available. Please check settings.");
        setIsLoading(false); setLoadingReason(null); return;
      }
      themeNameToLoad = selectNextThemeName(availableThemes);
      if (!themeNameToLoad) {
        setError("Failed to select an initial adventure theme.");
        setIsLoading(false); setLoadingReason(null); return;
      }
    }

    const themeObjToLoad = findThemeByName(themeNameToLoad);
    if (!themeObjToLoad) {
      setError(`Theme "${themeNameToLoad}" not found. Cannot start game.`);
      setIsLoading(false); setLoadingReason(null); return;
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

      draftState.mapData.nodes = previousState.mapData.nodes.filter(n => n.themeName !== themeObjToLoad.name);
      draftState.mapData.edges = previousState.mapData.edges.filter(e => {
          const sourceNode = previousState.mapData.nodes.find(n => n.id === e.sourceNodeId);
          const targetNode = previousState.mapData.nodes.find(n => n.id === e.targetNodeId);
          return (sourceNode && sourceNode.themeName !== themeObjToLoad.name) || (targetNode && targetNode.themeName !== themeObjToLoad.name);
      });
      draftState.allCharacters = previousState.allCharacters.filter(c => c.themeName !== themeObjToLoad.name);
    } else {
      draftState.mapData = { nodes: [], edges: [] };
      draftState.allCharacters = [];
      draftState.themeHistory = {};
      draftState.score = 0;
      draftState.inventory = [];
    }

    const baseStateSnapshotForInitialTurn = JSON.parse(JSON.stringify(draftState)) as FullGameState;
    let prompt = "";
    if (isTransitioningFromShift && draftState.themeHistory[themeObjToLoad.name]) {
      const currentThemeMainMapNodes = draftState.mapData.nodes.filter(n => n.themeName === themeObjToLoad.name && !n.data.isLeaf);
      const currentThemeCharacters = draftState.allCharacters.filter(c => c.themeName === themeObjToLoad.name);
      prompt = formatReturnToThemePostShiftPrompt(themeObjToLoad, draftState.inventory, playerGenderProp, draftState.themeHistory[themeObjToLoad.name], draftState.mapData, currentThemeCharacters);
    } else if (isTransitioningFromShift) {
      prompt = formatNewThemePostShiftPrompt(themeObjToLoad, draftState.inventory, playerGenderProp);
    } else { 
      prompt = formatNewGameFirstTurnPrompt(themeObjToLoad, playerGenderProp);
    }
    draftState.lastDebugPacket = { prompt, rawResponseText: null, parsedResponse: null, timestamp: new Date().toISOString() };

    try {
      const response = await executeAIMainTurn(prompt, themeObjToLoad.systemInstructionModifier);
      if (draftState.lastDebugPacket) draftState.lastDebugPacket.rawResponseText = response.text;
      
      const currentThemeMapDataForParse = {
            nodes: draftState.mapData.nodes.filter(n => n.themeName === themeObjToLoad.name),
            edges: draftState.mapData.edges.filter(e => {
                 const sourceNode = draftState.mapData.nodes.find(node => node.id === e.sourceNodeId);
                 const targetNode = draftState.mapData.nodes.find(node => node.id === e.targetNodeId);
                 return sourceNode?.themeName === themeObjToLoad.name && targetNode?.themeName === themeObjToLoad.name;
            })
      };
      const parsedData = await parseAIResponse(
          response.text, playerGenderProp, themeObjToLoad, handleParseAttemptFailed,
          undefined, undefined, 
          draftState.allCharacters.filter(c => c.themeName === themeObjToLoad.name), 
          currentThemeMapDataForParse, draftState.inventory
      );

      await processAiResponse(parsedData, themeObjToLoad, draftState, {
          baseStateSnapshot: baseStateSnapshotForInitialTurn,
          forceEmptyInventory: !isTransitioningFromShift && isRestart
      });

      setHasGameBeenInitialized(true);
      draftState.pendingNewThemeNameAfterShift = null;
       if (!isTransitioningFromShift || draftState.globalTurnNumber === 0) { 
        draftState.globalTurnNumber = 1; 
      }

    } catch (e: any) {
      console.error("Error loading initial game:", e);
      setError(`Failed to initialize the adventure in "${themeObjToLoad.name}": ${e.message || "Unknown AI error"}`);
      if (draftState.lastDebugPacket) draftState.lastDebugPacket.error = e.message || String(e);
    } finally {
      commitGameState(draftState);
      setIsLoading(false); setLoadingReason(null);
    }
  }, [
    playerGenderProp, enabledThemePacksProp, stabilityLevelProp, chaosLevelProp,
    handleParseAttemptFailed, processAiResponse, commitGameState, getCurrentGameState,
    setError, setIsLoading, setLoadingReason, findThemeByName, getInitialGameStates, onSettingsUpdateFromLoad
  ]);


  const handleStartNewGameFromButton = useCallback(() => {
    setHasGameBeenInitialized(false);
    loadInitialGame({ isRestart: true, customGameFlag: false });
  }, [loadInitialGame, setHasGameBeenInitialized]);

  const startCustomGame = useCallback((themeName: string) => {
    setHasGameBeenInitialized(false);
    loadInitialGame({ explicitThemeName: themeName, isRestart: true, customGameFlag: true });
  }, [loadInitialGame, setHasGameBeenInitialized]);

  const {
    triggerRealityShift,
    executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection
  } = useRealityShift({
    getCurrentGameState,
    setGameStateStack,
    loadInitialGame,
    enabledThemePacksProp,
    playerGenderProp,
    stabilityLevelProp,
    chaosLevelProp,
    setError,
    setLoadingReason,
    isLoading
  });


  const handleActionSelect = useCallback((action: string) => {
    const currentFullState = getCurrentGameState();
    if (action === "Try to force your way back to the previous reality.") {
      const previousThemeName = Object.keys(currentFullState.themeHistory).pop();
      if (previousThemeName) {
        const statePreparedForShift = {
            ...currentFullState,
            pendingNewThemeNameAfterShift: previousThemeName,
        };
        setGameStateStack(prev => [statePreparedForShift, prev[1]]);

        if (currentFullState.isCustomGameMode) {
          executeManualRealityShift();
        } else {
          triggerRealityShift();
        }
      } else {
        setError("No previous reality to return to.");
      }
    } else {
      executePlayerAction(action);
    }
  }, [getCurrentGameState, executePlayerAction, triggerRealityShift, setError, setGameStateStack, executeManualRealityShift]);

  const handleItemInteraction = useCallback((item: Item, interactionType: 'generic' | 'specific' | 'inspect', knownUse?: KnownUse) => {
    if (interactionType === 'inspect') {
      executePlayerAction(`Inspect: ${item.name}`);
    } else if (interactionType === 'specific' && knownUse) {
      executePlayerAction(knownUse.promptEffect);
    } else if (interactionType === 'generic') {
      executePlayerAction(`Attempt to use: ${item.name}`);
    }
  }, [executePlayerAction]);

  const handleDiscardJunkItem = useCallback((itemName: string) => {
    const currentFullState = getCurrentGameState();
    if (isLoading || currentFullState.dialogueState) return;

    const itemToDiscard = currentFullState.inventory.find(item => item.name === itemName);
    if (!itemToDiscard || !itemToDiscard.isJunk) return;

    let draftState = JSON.parse(JSON.stringify(currentFullState)) as FullGameState;
    draftState.inventory = draftState.inventory.filter(item => item.name !== itemName);
    const itemChangeRecord: ItemChangeRecord = { type: 'loss', lostItem: { ...itemToDiscard } };
    const turnChangesForDiscard: TurnChanges = {
      itemChanges: [itemChangeRecord], characterChanges: [], objectiveAchieved: false,
      objectiveTextChanged: false, mainQuestTextChanged: false, localTimeChanged: false,
      localEnvironmentChanged: false, localPlaceChanged: false, currentMapNodeIdChanged: false,
      scoreChangedBy: 0, mapDataChanged: false,
    };
    draftState.lastTurnChanges = turnChangesForDiscard;
    commitGameState(draftState);
  }, [getCurrentGameState, commitGameState, isLoading]);

  const handleRetry = useCallback(() => {
    setError(null);
    const currentFullState = getCurrentGameState();
    if (!hasGameBeenInitialized || !currentFullState.currentThemeName) {
      loadInitialGame({ isRestart: true, customGameFlag: currentFullState.isCustomGameMode ?? false });
    } else {
      const genericRetryState = {
        ...currentFullState,
        actionOptions: ["Look around.", "Ponder the situation.", "Try to move on.", "Check your inventory."],
        lastActionLog: "Attempting to re-establish connection with the narrative flow...",
        dialogueState: null,
      };
      commitGameState(genericRetryState);
      setIsLoading(false); setLoadingReason(null);
    }
  }, [getCurrentGameState, hasGameBeenInitialized, loadInitialGame, commitGameState, setError, setIsLoading, setLoadingReason]);

  const executeRestartGame = useCallback(() => {
    setError(null);
    setHasGameBeenInitialized(false);
    loadInitialGame({ isRestart: true, customGameFlag: false });
  }, [loadInitialGame, setError, setHasGameBeenInitialized]);

  const handleFreeFormActionSubmit = () => {
    const currentFullState = getCurrentGameState();
    if (freeFormActionText.trim() && currentFullState.score >= FREE_FORM_ACTION_COST && !isLoading && hasGameBeenInitialized && !currentFullState.dialogueState) {
      executePlayerAction(freeFormActionText.trim(), true);
    }
  };

  const handleMapLayoutConfigChange = useCallback((newConfig: MapLayoutConfig) => {
    setGameStateStack(prev => [{...prev[0], mapLayoutConfig: newConfig }, prev[1]]);
  }, [setGameStateStack]);

  useEffect(() => {
    if (isAppReady && !hasGameBeenInitialized) {
      if (initialSavedStateFromApp) {
        // Call loadInitialGame with the saved state
        loadInitialGame({ savedStateToLoad: initialSavedStateFromApp });
      }
    }
  }, [isAppReady, hasGameBeenInitialized, initialSavedStateFromApp, loadInitialGame]);

  const { isDialogueExiting, handleDialogueOptionSelect, handleForceExitDialogue } = useDialogueFlow({
    getCurrentGameState,
    commitGameState,
    playerGenderProp,
    setError,
    setIsLoading,
    setLoadingReason,
    onDialogueConcluded: (summaryPayload, preparedGameState) => {
      let draftState = JSON.parse(JSON.stringify(preparedGameState)) as FullGameState;
      processAiResponse(
        summaryPayload,
        preparedGameState.currentThemeObject, 
        draftState,
        { baseStateSnapshot: JSON.parse(JSON.stringify(preparedGameState)) as FullGameState, isFromDialogueSummary: true }
      ).then(() => {
        commitGameState(draftState);
        setIsLoading(false); setLoadingReason(null);
      }).catch(e => {
        console.error("Error in post-dialogue processAiResponse:", e);
        setError("Failed to fully process dialogue conclusion. Game state might be inconsistent.");
        commitGameState(preparedGameState);
        setIsLoading(false); setLoadingReason(null);
      });
    }
  });

  const handleUndoTurn = useCallback(() => {
    setGameStateStack(prevStack => {
      const [current, previous] = prevStack;
      if (previous && current.globalTurnNumber > 0) {
        if (objectiveAnimationClearTimerRef.current) {
            clearTimeout(objectiveAnimationClearTimerRef.current);
            objectiveAnimationClearTimerRef.current = null;
        }
        return [previous, current];
      }
      return prevStack;
    });
  }, [setGameStateStack]);

  const currentFullState = getCurrentGameState();

  return {
    currentTheme: currentFullState.currentThemeObject,
    currentScene: currentFullState.currentScene,
    actionOptions: currentFullState.actionOptions,
    mainQuest: currentFullState.mainQuest,
    currentObjective: currentFullState.currentObjective,
    inventory: currentFullState.inventory,
    gameLog: currentFullState.gameLog,
    lastActionLog: currentFullState.lastActionLog,
    isLoading: isLoading || (currentFullState.dialogueState !== null && isDialogueExiting),
    loadingReason,
    error,
    themeHistory: currentFullState.themeHistory,
    allCharacters: currentFullState.allCharacters,
    mapData: currentFullState.mapData,
    currentMapNodeId: currentFullState.currentMapNodeId,
    mapLayoutConfig: currentFullState.mapLayoutConfig || getDefaultMapLayoutConfig(),
    score: currentFullState.score,
    freeFormActionText,
    setFreeFormActionText,
    handleFreeFormActionSubmit,
    objectiveAnimationType: currentFullState.objectiveAnimationType,
    localTime: currentFullState.localTime,
    localEnvironment: currentFullState.localEnvironment,
    localPlace: currentFullState.localPlace,
    turnsSinceLastShift: currentFullState.turnsSinceLastShift,
    globalTurnNumber: currentFullState.globalTurnNumber,
    isCustomGameMode: currentFullState.isCustomGameMode ?? false,
    isAwaitingManualShiftThemeSelection: currentFullState.isAwaitingManualShiftThemeSelection ?? false,

    dialogueState: currentFullState.dialogueState,
    isDialogueExiting,
    handleDialogueOptionSelect,
    handleForceExitDialogue,

    lastDebugPacket: currentFullState.lastDebugPacket,
    lastTurnChanges: currentFullState.lastTurnChanges,
    gameStateStack,

    handleActionSelect,
    handleItemInteraction,
    handleDiscardJunkItem,
    handleRetry,
    executeRestartGame,
    executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection,
    startCustomGame,
    gatherCurrentGameState: gatherCurrentGameStateForSave,
    applyLoadedGameState: loadInitialGame, // Use loadInitialGame for applying saved state
    setError,
    setIsLoading,
    hasGameBeenInitialized,
    handleStartNewGameFromButton,
    handleMapLayoutConfigChange,
    handleUndoTurn,
  };
};
