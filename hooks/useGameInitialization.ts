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
  StoryAct,
  ThinkingEffort,
} from '../types';
import {
  executeAIMainTurn,
  parseAIResponse,
} from '../services/storyteller';
import { getMaxOutputTokens } from '../services/thinkingConfig';
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
import { isStoryArcValid } from '../utils/storyArcUtils';

export interface LoadInitialGameOptions {
  isRestart?: boolean;
  explicitThemeName?: string | null;
  savedStateToLoad?: GameStateStack | null;
  clearImages?: boolean;
}

export interface UseGameInitializationProps {
  enabledThemePacksProp: Array<ThemePackName>;
  preferredPlayerNameProp?: string;
  setIsLoading: (val: boolean) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  setError: (err: string | null) => void;
  setParseErrorCounter: (val: number) => void;
  setHasGameBeenInitialized: (val: boolean) => void;
  thinkingEffortProp: ThinkingEffort;
  getCurrentGameState: () => FullGameState;
  commitGameState: (state: FullGameState) => void;
  resetGameStateStack: (state: FullGameState) => void;
  setGameStateStack: (stack: GameStateStack) => void;
  processAiResponse: ProcessAiResponseFn;
  openCharacterSelectModal: (
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
  ) => Promise<void>;
  openGenderSelectModal: (defaultGender: string) => Promise<string>;
  onActIntro: (act: StoryAct) => void;
}

/**
 * Provides functions for starting new games and saving/loading state.
 */
export const useGameInitialization = (props: UseGameInitializationProps) => {
  const {
    enabledThemePacksProp,
    preferredPlayerNameProp,
    setIsLoading,
    setLoadingReason,
    setError,
    setParseErrorCounter,
    setHasGameBeenInitialized,
    thinkingEffortProp,
    getCurrentGameState,
    commitGameState,
    resetGameStateStack,
    setGameStateStack,
    processAiResponse,
    openCharacterSelectModal,
    openGenderSelectModal,
    onActIntro,
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
        let themeForLoadedState = currentSaved.currentTheme;
        if (!themeForLoadedState) {
          const legacyName = (currentSaved as { currentThemeName?: string | null }).currentThemeName;
          if (legacyName) themeForLoadedState = findThemeByName(legacyName);
        }
        if (!themeForLoadedState) {
          const warnName = (currentSaved as { currentThemeName?: string | null }).currentThemeName;
          if (warnName) setError(`Failed to apply loaded state: Theme "${warnName}" not found. Game state may be unstable.`);
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
          currentTheme: themeForLoadedState,
          mapData: mapDataToApply,
          currentMapNodeId: currentMapNodeIdToApply,
          destinationNodeId: destinationToApply,
          mapLayoutConfig: mapLayoutConfigToApply,
          mapViewBox: currentSaved.mapViewBox,
          globalTurnNumber: currentSaved.globalTurnNumber,
          enabledThemePacks: enabledThemePacksProp,
          thinkingEffort: thinkingEffortProp,
          isVictory: false,
        } as FullGameState;

        const prev = previousSaved
          ? {
              ...previousSaved,
              enabledThemePacks: enabledThemePacksProp,
              thinkingEffort: thinkingEffortProp,
              isVictory: false,
            }
          : stateWithMapData;

        setGameStateStack([stateWithMapData, prev]);
        const arc = stateWithMapData.storyArc;
        const act = arc ? arc.acts[arc.currentAct - 1] : null;
        if (act) onActIntro(act);

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

      const selectedGender = await openGenderSelectModal(
        getCurrentGameState().heroSheet?.gender ?? 'Male',
      );

      let draftState = getInitialGameStates();
      draftState.enabledThemePacks = enabledThemePacksProp;
      draftState.mapLayoutConfig = getDefaultMapLayoutConfig();
      draftState.mapViewBox = DEFAULT_VIEWBOX;
      draftState.globalTurnNumber = 0;
      draftState.currentTheme = themeObjToLoad;
      draftState.thinkingEffort = thinkingEffortProp;
      draftState.heroSheet = {
        name: 'Hero',
        gender: selectedGender,
        heroShortName: 'Hero',
        occupation: '',
        traits: [],
        startingItems: [],
      };

      const worldFacts = await generateWorldFacts(themeObjToLoad);
      const safeWorldFacts = worldFacts ?? {
        geography: '',
        climate: '',
        technologyLevel: '',
        supernaturalElements: '',
        majorFactions: [],
        keyResources: [],
        culturalNotes: [],
        notableLocations: [],
      };
      draftState.worldFacts = worldFacts ?? null;
      commitGameState(draftState);

      const names = await generateCharacterNames(
        themeObjToLoad,
        selectedGender,
        safeWorldFacts,
      );
      if (!names || names.length === 0) {
        setError('Failed to generate character options. Please retry.');
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }
      let heroSheet: HeroSheet | null = null;
      let heroBackstory: HeroBackstory | null = null;
      const shuffledBase = [...names].sort(() => Math.random() - 0.5).slice(0, 10);
      const sanitizedPref = (preferredPlayerNameProp ?? '')
        .replace(/[^a-zA-Z0-9\s\-"']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const shuffled = sanitizedPref && sanitizedPref.length > 0
        ? [sanitizedPref, ...shuffledBase.filter(n => n !== sanitizedPref)].slice(0, 10)
        : shuffledBase;
      const descriptions = await generateCharacterDescriptions(
        themeObjToLoad,
        selectedGender,
        safeWorldFacts,
        shuffled,
      );
      if (!descriptions) {
        setError('Failed to generate character descriptions. Please retry.');
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }
      let initialTurnPromise: Promise<void> = Promise.resolve();
      const waitForBegin = openCharacterSelectModal(
        {
          theme: themeObjToLoad,
          heroGender: selectedGender,
          worldFacts: safeWorldFacts,
          options: descriptions,
        },
        result => {
          heroSheet = result.heroSheet;
          heroBackstory = result.heroBackstory;
          draftState.storyArc = result.storyArc;
          draftState.heroSheet = heroSheet;
          draftState.heroBackstory = heroBackstory;
          if (!result.storyArc || !isStoryArcValid(result.storyArc)) {
            setError('Failed to generate a valid story arc. Please retry.');
            setIsLoading(false);
            setLoadingReason(null);
            return Promise.resolve();
          }
          initialTurnPromise = (async () => {
            if (worldFacts) {
              const initialFacts = await extractInitialFacts_Service({
                themeName: themeObjToLoad.name,
                worldFacts: safeWorldFacts,
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
                );
              }
            }

            draftState.mapData = { nodes: [], edges: [] };
            draftState.allNPCs = [];
            draftState.score = 0;
            draftState.inventory = [];

            if (draftState.heroSheet) draftState.heroSheet.gender = selectedGender;
            const baseStateSnapshotForInitialTurn = structuredCloneGameState(draftState);
            let prompt = '';
            try {
              prompt = buildInitialGamePrompt({
                theme: themeObjToLoad,
                storyArc: draftState.storyArc ?? undefined,
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

              const {
                response,
                thoughts,
                systemInstructionUsed,
                jsonSchemaUsed,
                promptUsed,
              } = await executeAIMainTurn(prompt, getMaxOutputTokens(4096));
              draftState.lastDebugPacket.rawResponseText = response.text ?? null;
              draftState.lastDebugPacket.storytellerThoughts = thoughts;
              draftState.lastDebugPacket.systemInstruction = systemInstructionUsed;
              draftState.lastDebugPacket.jsonSchema = jsonSchemaUsed;
              draftState.lastDebugPacket.prompt = promptUsed;

              const currentThemeMapDataForParse = draftState.mapData;
              const parsedData = await parseAIResponse(
                response.text ?? '',
                themeObjToLoad,
                draftState.heroSheet,
                () => {
                  setParseErrorCounter(1);
                },
                undefined,
                undefined,
                draftState.allNPCs,
                currentThemeMapDataForParse,
                draftState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
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
          })();
          return initialTurnPromise;
        },
      );

      await waitForBegin;
      await initialTurnPromise;
      return;
    }, [
      enabledThemePacksProp,
      thinkingEffortProp,
      setIsLoading,
      setLoadingReason,
      setError,
      setParseErrorCounter,
      setHasGameBeenInitialized,
      commitGameState,
      processAiResponse,
      setGameStateStack,
      openCharacterSelectModal,
      openGenderSelectModal,
      getCurrentGameState,
      onActIntro,
      preferredPlayerNameProp,
    ]);

  /**
   * Starts a completely new game.
   * The current state is cleared immediately so the UI does not display stale
   * information while the initial turn is loading.
   */
  const handleStartNewGameFromButton = useCallback(() => {
    const blankState = getInitialGameStatesWithSettings(
      enabledThemePacksProp
    );
    blankState.thinkingEffort = thinkingEffortProp;
    resetGameStateStack(blankState);
    setHasGameBeenInitialized(false);
    void loadInitialGame({ isRestart: true });
  }, [
    loadInitialGame,
    setHasGameBeenInitialized,
    resetGameStateStack,
    enabledThemePacksProp,
    thinkingEffortProp,
  ]);

  /** Starts a new game using the provided theme name. */
  const startCustomGame = useCallback(
    (themeName: string) => {
      const blankState = getInitialGameStatesWithSettings(
        enabledThemePacksProp
      );
      blankState.thinkingEffort = thinkingEffortProp;
      resetGameStateStack(blankState);
      setHasGameBeenInitialized(false);
      void loadInitialGame({ explicitThemeName: themeName, isRestart: true });
    },
    [
      loadInitialGame,
      setHasGameBeenInitialized,
      resetGameStateStack,
      enabledThemePacksProp,
      thinkingEffortProp,
    ]
  );

  /** Restarts the game from scratch. */
  const executeRestartGame = useCallback(() => {
    setError(null);
    const blankState = getInitialGameStatesWithSettings(
      enabledThemePacksProp
    );
    blankState.thinkingEffort = thinkingEffortProp;
    resetGameStateStack(blankState);
    setHasGameBeenInitialized(false);
    void loadInitialGame({ isRestart: true });
  }, [
    loadInitialGame,
    setError,
    setHasGameBeenInitialized,
    resetGameStateStack,
    enabledThemePacksProp,
    thinkingEffortProp,
  ]);

  /** Retry helper used when an error occurred in the main logic. */
  const handleRetry = useCallback(async () => {
    setError(null);
    const currentFullState = getCurrentGameState();

    // If no theme has been initialized yet, retry initial load
    if (!currentFullState.currentTheme) {
      await loadInitialGame({
        isRestart: true,
      });
      return;
    }

    const lastPrompt = currentFullState.lastDebugPacket?.prompt;
    const currentThemeObj = currentFullState.currentTheme;

    // Fallback to generic retry if prompt or theme data is missing
    if (!lastPrompt) {
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

      const currentThemeNPCs = draftState.allNPCs;
      const currentThemeMapDataForParse = draftState.mapData;

      const parsedData = await parseAIResponse(
        response.text ?? '',
        currentThemeObj,
        draftState.heroSheet,
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
  ]);

  return {
    loadInitialGame,
    handleStartNewGameFromButton,
    startCustomGame,
    executeRestartGame,
    handleRetry,
  };
};
