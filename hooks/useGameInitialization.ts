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
  getInitialGameStatesWithSettings,
  PLACEHOLDER_THEME,
  createDefaultWorldFacts,
  createDefaultStoryArc,
  createDefaultHeroSheet,
  createDefaultHeroBackstory,
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
import { ensureCoreGameStateIntegrity } from '../utils/gameStateIntegrity';
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
        const mergeMapLayoutConfig = (
          config?: Partial<FullGameState['mapLayoutConfig']> | null,
        ): FullGameState['mapLayoutConfig'] => {
          const defaults = getDefaultMapLayoutConfig();
          const merged = { ...defaults };
          const source = config ?? {};
          (Object.keys(defaults) as Array<keyof typeof defaults>).forEach(key => {
            const rawValue = (source as Partial<Record<keyof typeof defaults, number>>)[key];
            merged[key] = typeof rawValue === 'number' ? rawValue : defaults[key];
          });
          return merged;
        };

        const hydrateLoadedState = async (
          rawState: FullGameState,
          context: 'current' | 'previous',
        ): Promise<FullGameState> => {
          const cloned = structuredCloneGameState(rawState);
          const theme = cloned.theme;
          const repairedMap = await repairFeatureHierarchy(cloned.mapData, theme);
          const normalizedDestination =
            typeof cloned.destinationNodeId === 'string' ? cloned.destinationNodeId : null;
          const hydrated = {
            ...cloned,
            theme: theme,
            mapData: repairedMap,
            mapLayoutConfig: mergeMapLayoutConfig(cloned.mapLayoutConfig),
            destinationNodeId: normalizedDestination,
            enabledThemePacks: enabledThemePacksProp,
            thinkingEffort: thinkingEffortProp,
            isVictory: false,
          } as FullGameState;
          return ensureCoreGameStateIntegrity(hydrated, `loadInitialGame.${context}`);
        };

        const [rawCurrent, rawPrevious] = savedStateToLoad;
        const hydratedCurrent = await hydrateLoadedState(rawCurrent, 'current');
        const hydratedPrevious = rawPrevious
          ? await hydrateLoadedState(rawPrevious, 'previous')
          : hydratedCurrent;

        setGameStateStack([hydratedCurrent, hydratedPrevious]);
        if (isStoryArcValid(hydratedCurrent.storyArc)) {
          const acts = hydratedCurrent.storyArc.acts;
          const actIndex = Math.max(0, hydratedCurrent.storyArc.currentAct - 1);
          if (actIndex < acts.length) {
            onActIntro(acts[actIndex]);
          }
        }

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

      // Enter gender selection stage
      {
        const s = getCurrentGameState();
        const draft = { ...s, startState: 'gender_select' } as FullGameState;
        commitGameState(draft);
      }
      const currentHeroGender = getCurrentGameState().heroSheet.gender;
      const selectedGender = await openGenderSelectModal(
        currentHeroGender && currentHeroGender !== 'Unspecified'
          ? currentHeroGender
          : 'Male',
      );

      let draftState = getInitialGameStates();
      draftState.enabledThemePacks = enabledThemePacksProp;
      draftState.mapLayoutConfig = getDefaultMapLayoutConfig();
      draftState.mapViewBox = DEFAULT_VIEWBOX;
      draftState.globalTurnNumber = 0;
      draftState.theme = themeObjToLoad;
      draftState.thinkingEffort = thinkingEffortProp;
      draftState.heroSheet = {
        ...createDefaultHeroSheet(),
        gender: selectedGender,
        occupation: '',
        traits: [],
        startingItems: [],
      };
      draftState.startState = 'seeding_facts';

      const generatedWorldFacts = await generateWorldFacts(themeObjToLoad);
      const worldFactsForGame = generatedWorldFacts ?? createDefaultWorldFacts();
      draftState.worldFacts = worldFactsForGame;
      commitGameState(draftState);

      const names = await generateCharacterNames(
        themeObjToLoad,
        selectedGender,
        worldFactsForGame,
      );
      if (!names || names.length === 0) {
        setError('Failed to generate character options. Please retry.');
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }
      const shuffledBase = [...names].sort(() => Math.random() - 0.5).slice(0, 10);
      const sanitizedPref = (preferredPlayerNameProp ?? '')
        .replace(/[^a-zA-Z0-9\s\-"']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const shuffled = sanitizedPref && sanitizedPref.length > 0
        ? [sanitizedPref, ...shuffledBase.filter(n => n !== sanitizedPref)].slice(0, 10)
        : shuffledBase;
      // Move to character selection stage
      draftState.startState = 'character_select';
      commitGameState(draftState);
      const descriptions = await generateCharacterDescriptions(
        themeObjToLoad,
        selectedGender,
        worldFactsForGame,
        shuffled,
      );
      if (!descriptions) {
        setError('Failed to generate character descriptions. Please retry.');
        setIsLoading(false);
        setLoadingReason(null);
        return;
      }
      let initialTurnPromise: Promise<void> = Promise.resolve();
      let hasValidStoryArc = false;
      let hasGeneratedHeroData = false;
      const waitForBegin = openCharacterSelectModal(
        {
          theme: themeObjToLoad,
          heroGender: selectedGender,
          worldFacts: worldFactsForGame,
          options: descriptions,
        },
        result => {
          const resolvedHeroSheet = result.heroSheet ?? createDefaultHeroSheet();
          const resolvedHeroBackstory = result.heroBackstory ?? createDefaultHeroBackstory();
          const resolvedStoryArc = result.storyArc ?? createDefaultStoryArc();

          hasGeneratedHeroData = Boolean(result.heroSheet && result.heroBackstory);
          hasValidStoryArc = isStoryArcValid(result.storyArc);

          const heroSheetForState = { ...resolvedHeroSheet, gender: selectedGender };

          draftState.storyArc = resolvedStoryArc;
          draftState.heroSheet = heroSheetForState;
          draftState.heroBackstory = resolvedHeroBackstory;

          if (!hasValidStoryArc) {
            setError('Failed to generate a valid story arc. Please retry.');
            setIsLoading(false);
            setLoadingReason(null);
            return Promise.resolve();
          }
          initialTurnPromise = (async () => {
            draftState.startState = 'seeding_facts';
            if (generatedWorldFacts) {
              const initialFacts = await extractInitialFacts_Service({
                themeName: themeObjToLoad.name,
                worldFacts: generatedWorldFacts,
                heroSheet: hasGeneratedHeroData ? heroSheetForState : undefined,
                heroBackstory: hasGeneratedHeroData ? resolvedHeroBackstory : undefined,
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
            const baseStateSnapshotForInitialTurn = structuredCloneGameState(draftState);
            let prompt = '';
            try {
              prompt = buildInitialGamePrompt({
                theme: themeObjToLoad,
                storyArc: draftState.storyArc,
                worldFacts: draftState.worldFacts,
                heroSheet: draftState.heroSheet,
                heroBackstory: draftState.heroBackstory,
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
              draftState.startState = 'first_turn_ai';
              const {
                response,
                thoughts,
                systemInstructionUsed,
                jsonSchemaUsed,
                promptUsed,
              } = await executeAIMainTurn(prompt, { maxOutputTokensOverride: getMaxOutputTokens(4096) });
              draftState.lastDebugPacket.rawResponseText = response.text ?? null;
              draftState.lastDebugPacket.storytellerThoughts = thoughts;
              draftState.lastDebugPacket.systemInstruction = systemInstructionUsed;
              draftState.lastDebugPacket.jsonSchema = jsonSchemaUsed;
              draftState.lastDebugPacket.prompt = promptUsed;

              const themeMapDataForParse = draftState.mapData;
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
                themeMapDataForParse,
                draftState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
              );

              await processAiResponse(parsedData, themeObjToLoad, draftState, {
                baseStateSnapshot: baseStateSnapshotForInitialTurn,
                forceEmptyInventory: isRestart,
                playerActionText: undefined,
              });

              setHasGameBeenInitialized(true);
              draftState.globalTurnNumber = 1;
              draftState.startState = 'ready';
              draftState.turnState = 'awaiting_input';
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

      // After player closes character select, always show Act 1 intro when valid data exists
      if (isStoryArcValid(draftState.storyArc)) {
        const acts = draftState.storyArc.acts;
        const actIdx = Math.max(0, draftState.storyArc.currentAct - 1);
        if (actIdx < acts.length) {
          onActIntro(acts[actIdx]);
        }
      }
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
    const isThemeInitialized = currentFullState.theme.name !== PLACEHOLDER_THEME.name;
    if (!isThemeInitialized) {
      await loadInitialGame({
        isRestart: true,
      });
      return;
    }

    const lastPrompt = currentFullState.lastDebugPacket?.prompt;
    const themeObj = currentFullState.theme;

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
    draftState.turnState = 'storyteller';
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

      const themeNPCs = draftState.allNPCs;
      const themeMapDataForParse = draftState.mapData;

      const parsedData = await parseAIResponse(
        response.text ?? '',
        themeObj,
        draftState.heroSheet,
        () => { setParseErrorCounter(1); },
        currentFullState.lastActionLog || undefined,
        currentFullState.currentScene,
        themeNPCs,
        themeMapDataForParse,
        currentFullState.inventory.filter(i => i.holderId === PLAYER_HOLDER_ID),
      );

      await processAiResponse(parsedData, themeObj, draftState, {
        baseStateSnapshot,
        scoreChangeFromAction: 0,
        playerActionText: undefined,
      });

      draftState.globalTurnNumber += 1;
      draftState.turnState = 'awaiting_input';
    } catch (e: unknown) {
      console.error('Error retrying last main AI request:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(`Retry failed: ${errMsg}.`);
      draftState = structuredCloneGameState(baseStateSnapshot);
      draftState.turnState = 'error';
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
