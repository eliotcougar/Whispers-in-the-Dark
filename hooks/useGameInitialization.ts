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
  AdventureTheme,
  WorldFacts,
  CharacterOption,
  HeroSheet,
  HeroBackstory,
  StoryArc,
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
import { clearAllImages } from '../services/imageDb';
import {
  generateWorldFacts,
  generateCharacterNames,
  generateCharacterDescriptions,
} from '../services/worldData';
import { extractInitialFacts_Service } from '../services/loremaster';
import { applyThemeFactChanges } from '../utils/gameLogicUtils';

export interface LoadInitialGameOptions {
  isRestart?: boolean;
  explicitThemeName?: string | null;
  savedStateToLoad?: GameStateStack | null;
  clearImages?: boolean;
}

export interface UseGameInitializationProps {
  playerGenderProp: string;
  enabledThemePacksProp: Array<ThemePackName>;
  setIsLoading: (val: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
  setParseErrorCounter: (val: number) => void;
  setHasGameBeenInitialized: (val: boolean) => void;
  onSettingsUpdateFromLoad: (
    loaded: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks'>>
  ) => void;
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  resetGameStateStack: (state: FullGameState) => void;
  setGameStateStack: (stack: GameStateStack) => void;
  processAiResponse: ProcessAiResponseFn;
  openCharacterSelectModal: (
    data: {
      theme: AdventureTheme;
      playerGender: string;
      worldFacts: WorldFacts;
      options: Array<CharacterOption>;
    },
  ) => Promise<{
    name: string;
    heroSheet: HeroSheet | null;
    heroBackstory: HeroBackstory | null;
    storyArc: StoryArc | null;
  }>;
}

/**
 * Provides functions for starting new games and saving/loading state.
 */
export const useGameInitialization = (props: UseGameInitializationProps) => {
  const {
    playerGenderProp,
    enabledThemePacksProp,
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
    openCharacterSelectModal,
  } = props;


  /**
   * Loads the initial game state or applies a saved state to the game.
   */
  const loadInitialGame = useCallback(
    async (options: LoadInitialGameOptions = {}) => {
      const {
        isRestart = false,
        explicitThemeName = null,
        savedStateToLoad = null,
        clearImages = false,
      } = options;

      setIsLoading(true);
      setLoadingReason('initial_load');
      setError(null);
      setParseErrorCounter(0);

      if (isRestart || clearImages) {
        await clearAllImages();
      }

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
          globalTurnNumber: currentSaved.globalTurnNumber,
        } as FullGameState;

        setGameStateStack([stateWithMapData, previousSaved ?? stateWithMapData]);

        onSettingsUpdateFromLoad({
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
      draftState.mapLayoutConfig = getDefaultMapLayoutConfig();
      draftState.mapViewBox = DEFAULT_VIEWBOX;
      draftState.globalTurnNumber = 0;
      draftState.currentThemeName = themeObjToLoad.name;
      draftState.currentThemeObject = themeObjToLoad;

      const worldFacts = await generateWorldFacts(themeObjToLoad);
      draftState.worldFacts = worldFacts ?? null;

      const names = await generateCharacterNames(
        themeObjToLoad,
        playerGenderProp,
        worldFacts ?? { geography: '', climate: '', technologyLevel: '', supernaturalElements: '', majorFactions: [], keyResources: [], culturalNotes: [], notableLocations: [] },
      );
      let heroSheet: HeroSheet | null = null;
      let heroBackstory: HeroBackstory | null = null;
      if (names && names.length > 0) {
        const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, 10);
        const descriptions = await generateCharacterDescriptions(
          themeObjToLoad,
          worldFacts ?? {
            geography: '',
            climate: '',
            technologyLevel: '',
            supernaturalElements: '',
            majorFactions: [],
            keyResources: [],
            culturalNotes: [],
            notableLocations: [],
          },
          shuffled,
        );
        if (descriptions) {
          const result = await openCharacterSelectModal({
            theme: themeObjToLoad,
            playerGender: playerGenderProp,
            worldFacts: worldFacts ?? {
              geography: '',
              climate: '',
              technologyLevel: '',
              supernaturalElements: '',
              majorFactions: [],
              keyResources: [],
              culturalNotes: [],
              notableLocations: [],
            },
            options: descriptions,
          });
          heroSheet = result.heroSheet;
          heroBackstory = result.heroBackstory;
          draftState.storyArc = result.storyArc;
          draftState.heroSheet = heroSheet;
          draftState.heroBackstory = heroBackstory;
          if (worldFacts) {
            const initialFacts = await extractInitialFacts_Service({
              themeName: themeObjToLoad.name,
              worldFacts,
              heroSheet: heroSheet ?? undefined,
              heroBackstory: heroBackstory ?? undefined,
              onSetLoadingReason: setLoadingReason,
            });
            if (initialFacts) {
              if (draftState.lastDebugPacket?.loremasterDebugInfo) {
                draftState.lastDebugPacket.loremasterDebugInfo.extract =
                  initialFacts.debugInfo.extract;
              }
              const changes = initialFacts.facts.map(f => ({
                action: 'add' as const,
                text: f.text,
                entities: f.entities,
              }));
              applyThemeFactChanges(
                draftState,
                changes,
                draftState.globalTurnNumber,
                themeObjToLoad.name,
              );
            }
          }
        }
      }

      draftState.mapData = { nodes: [], edges: [] };
      draftState.allNPCs = [];
      draftState.score = 0;
      draftState.inventory = [];
      draftState.mapViewBox = DEFAULT_VIEWBOX;

      const baseStateSnapshotForInitialTurn = structuredCloneGameState(draftState);
      const prompt = buildInitialGamePrompt({
        theme: themeObjToLoad,
        playerGender: playerGenderProp,
        worldFacts: draftState.worldFacts ?? undefined,
        heroSheet: draftState.heroSheet ?? undefined,
        heroBackstory: draftState.heroBackstory ?? undefined,
      });
      draftState.lastDebugPacket = {
        prompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        jsonSchema: undefined,
        rawResponseText: null,
        parsedResponse: null,
        timestamp: new Date().toISOString(),
        storytellerThoughts: null,
        mapUpdateDebugInfo: null,
        inventoryDebugInfo: null,
        librarianDebugInfo: null,
        loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null, journal: null },
        dialogueDebugInfo: null,
      };

      try {
        const {
          response,
          thoughts,
          systemInstructionUsed,
          jsonSchemaUsed,
          promptUsed,
        } = await executeAIMainTurn(prompt);
        draftState.lastDebugPacket.rawResponseText = response.text ?? null;
        draftState.lastDebugPacket.storytellerThoughts = thoughts;
        draftState.lastDebugPacket.systemInstruction = systemInstructionUsed;
        draftState.lastDebugPacket.jsonSchema = jsonSchemaUsed;
        draftState.lastDebugPacket.prompt = promptUsed;

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
          forceEmptyInventory: isRestart,
          playerActionText: undefined,
        });


        setHasGameBeenInitialized(true);
        draftState.globalTurnNumber = 1;
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
      setIsLoading,
      setLoadingReason,
      setError,
      setParseErrorCounter,
      setHasGameBeenInitialized,
      onSettingsUpdateFromLoad,
      commitGameState,
      processAiResponse,
      setGameStateStack,
      openCharacterSelectModal,
    ]);

  /**
   * Starts a completely new game.
   * The current state is cleared immediately so the UI does not display stale
   * information while the initial turn is loading.
   */
  const handleStartNewGameFromButton = useCallback(() => {
    const blankState = getInitialGameStatesWithSettings(
      playerGenderProp,
      enabledThemePacksProp
    );
    resetGameStateStack(blankState);
    setHasGameBeenInitialized(false);
    void loadInitialGame({ isRestart: true });
  }, [
    loadInitialGame,
    setHasGameBeenInitialized,
    resetGameStateStack,
    playerGenderProp,
    enabledThemePacksProp,
  ]);

  /** Starts a new game using the provided theme name. */
  const startCustomGame = useCallback(
    (themeName: string) => {
      const blankState = getInitialGameStatesWithSettings(
        playerGenderProp,
        enabledThemePacksProp
      );
      resetGameStateStack(blankState);
      setHasGameBeenInitialized(false);
      void loadInitialGame({ explicitThemeName: themeName, isRestart: true });
    },
    [
      loadInitialGame,
      setHasGameBeenInitialized,
      resetGameStateStack,
      playerGenderProp,
      enabledThemePacksProp,
    ]
  );

  /** Restarts the game from scratch. */
  const executeRestartGame = useCallback(() => {
    setError(null);
    const blankState = getInitialGameStatesWithSettings(
      playerGenderProp,
      enabledThemePacksProp
    );
    resetGameStateStack(blankState);
    setHasGameBeenInitialized(false);
    void loadInitialGame({ isRestart: true });
  }, [
    loadInitialGame,
    setError,
    setHasGameBeenInitialized,
    resetGameStateStack,
    playerGenderProp,
    enabledThemePacksProp,
  ]);

  /** Retry helper used when an error occurred in the main logic. */
  const handleRetry = useCallback(async () => {
    setError(null);
    const currentFullState = getCurrentGameState();

    // If no theme has been initialized yet, retry initial load
    if (!currentFullState.currentThemeName) {
      await loadInitialGame({
        isRestart: true,
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
      systemInstruction: SYSTEM_INSTRUCTION,
      jsonSchema: undefined,
      rawResponseText: null,
      parsedResponse: null,
      timestamp: new Date().toISOString(),
      storytellerThoughts: null,
      mapUpdateDebugInfo: null,
      inventoryDebugInfo: null,
      librarianDebugInfo: null,
      loremasterDebugInfo: { collect: null, extract: null, integrate: null, distill: null, journal: null },
      dialogueDebugInfo: null,
    };
    draftState.lastDebugPacket = debugPacket;

    try {
      const {
        response,
        thoughts,
        systemInstructionUsed,
        jsonSchemaUsed,
        promptUsed,
      } = await executeAIMainTurn(lastPrompt);
      draftState.lastDebugPacket.rawResponseText = response.text ?? null;
      draftState.lastDebugPacket.storytellerThoughts = thoughts;
      draftState.lastDebugPacket.systemInstruction = systemInstructionUsed;
      draftState.lastDebugPacket.jsonSchema = jsonSchemaUsed;
      draftState.lastDebugPacket.prompt = promptUsed;

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
