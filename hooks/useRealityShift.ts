/**
 * @file useRealityShift.ts
 * @description Hook that manages reality shift mechanics including theme summarization and manual shifts.
 */

import { useCallback, useRef, Dispatch, SetStateAction } from 'react';
import {
  AdventureTheme,
  ThemePackName,
  FullGameState,
  GameStateStack,
  LoadingReason,
  ThemeMemory
} from '../types';
import { getThemesFromPacks } from '../themes';
import { summarizeThemeAdventure_Service } from '../services/storyteller';
import { selectNextThemeName } from '../utils/gameLogicUtils';
import { getInitialGameStates } from '../utils/initialStates';

export interface UseRealityShiftProps {
  getCurrentGameState: () => FullGameState;
  setGameStateStack: Dispatch<SetStateAction<GameStateStack>>;
  loadInitialGame: (options: { explicitThemeName?: string | null; isRestart?: boolean; isTransitioningFromShift?: boolean; customGameFlag?: boolean; savedStateToLoad?: FullGameState | null; }) => void;
  enabledThemePacksProp: ThemePackName[];
  playerGenderProp: string;
  stabilityLevelProp: number;
  chaosLevelProp: number;
  setError: (err: string | null) => void;
  setLoadingReason: (reason: LoadingReason | null) => void;
  isLoading: boolean;
}

export const useRealityShift = (props: UseRealityShiftProps) => {
  const {
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
  } = props;

  const isSummarizingThemeRef = useRef<Record<string, boolean>>({});

  /** Summarizes the current theme and stores it in the game state's history. */
  const summarizeAndStoreThemeHistory = useCallback(async (themeToSummarize: AdventureTheme, finalStateBeforeShift: FullGameState) => {
    if (isSummarizingThemeRef.current[themeToSummarize.name]) return;
    isSummarizingThemeRef.current[themeToSummarize.name] = true;

    const summary = await summarizeThemeAdventure_Service(
      themeToSummarize,
      finalStateBeforeShift.currentScene,
      finalStateBeforeShift.gameLog
    );

    const themeMainMapNodes = finalStateBeforeShift.mapData.nodes.filter(
      n =>
        n.themeName === themeToSummarize.name &&
        n.data.nodeType !== 'feature' &&
        n.data.nodeType !== 'room'
    );
    const themeCharacters = finalStateBeforeShift.allCharacters.filter(c => c.themeName === themeToSummarize.name);

    const themeMemory: ThemeMemory = {
      summary: summary || 'The details of this reality are hazy...',
      mainQuest: finalStateBeforeShift.mainQuest || 'Unknown',
      currentObjective: finalStateBeforeShift.currentObjective || 'Unknown',
      placeNames: themeMainMapNodes.map(node => node.placeName),
      characterNames: themeCharacters.map(c => c.name)
    };

    setGameStateStack((prevStack: GameStateStack) => {
      const newFullState = { ...prevStack[0] };
      newFullState.themeHistory = { ...newFullState.themeHistory, [themeToSummarize.name]: themeMemory };
      return [newFullState, prevStack[1]];
    });

    delete isSummarizingThemeRef.current[themeToSummarize.name];
  }, [setGameStateStack]);

  /** Initiates a reality shift, optionally as a chaos shift. */
  const triggerRealityShift = useCallback((isChaosShift: boolean = false) => {
    const currentFullState = getCurrentGameState();
    const currentThemeObj = currentFullState.currentThemeObject;

    if (!currentThemeObj || isLoading) return;

    void summarizeAndStoreThemeHistory(currentThemeObj, currentFullState);
    setLoadingReason('reality_shift_load');

    const targetThemeName: string | null = (() => {
      if (
        currentFullState.pendingNewThemeNameAfterShift &&
        !currentFullState.isAwaitingManualShiftThemeSelection
      ) {
        return currentFullState.pendingNewThemeNameAfterShift;
      }
      if (!currentFullState.isAwaitingManualShiftThemeSelection) {
        const availableThemes = getThemesFromPacks(enabledThemePacksProp);
        return selectNextThemeName(availableThemes, currentThemeObj.name);
      }
      return null;
    })();

    if (!targetThemeName && !currentFullState.isAwaitingManualShiftThemeSelection) {
      setError('Could not select a new theme for reality shift. Current theme remains.');
      setLoadingReason(null);
      return;
    }

    const previousCustomMode = currentFullState.isCustomGameMode ?? false;

    setGameStateStack((prevStack: GameStateStack) => {
      let newStateForShiftStart = { ...prevStack[0] };
      const inventoryToCarryOver = newStateForShiftStart.inventory;
      const scoreToCarryOver = newStateForShiftStart.score;
      const themeHistoryToCarryOver = newStateForShiftStart.themeHistory;
      const mapDataToCarryOver = newStateForShiftStart.mapData;
      const allCharactersToCarryOver = newStateForShiftStart.allCharacters;
      const mapLayoutConfigToCarryOver = newStateForShiftStart.mapLayoutConfig;
      const globalTurnNumberToCarryOver = newStateForShiftStart.globalTurnNumber;

      newStateForShiftStart = getInitialGameStates();
      newStateForShiftStart.inventory = inventoryToCarryOver;
      newStateForShiftStart.score = scoreToCarryOver;
      newStateForShiftStart.themeHistory = themeHistoryToCarryOver;
      newStateForShiftStart.mapData = mapDataToCarryOver;
      newStateForShiftStart.allCharacters = allCharactersToCarryOver;
      newStateForShiftStart.mapLayoutConfig = mapLayoutConfigToCarryOver;
      newStateForShiftStart.globalTurnNumber = globalTurnNumberToCarryOver;

      newStateForShiftStart.pendingNewThemeNameAfterShift = targetThemeName;
      newStateForShiftStart.currentThemeName = null;
      newStateForShiftStart.currentThemeObject = null;
      newStateForShiftStart.dialogueState = null;
      newStateForShiftStart.turnsSinceLastShift = 0;
      newStateForShiftStart.isCustomGameMode = previousCustomMode;
      newStateForShiftStart.isAwaitingManualShiftThemeSelection = currentFullState.isAwaitingManualShiftThemeSelection;

      if (isChaosShift) newStateForShiftStart.score = Math.max(0, newStateForShiftStart.score - 10);

      newStateForShiftStart.playerGender = playerGenderProp;
      newStateForShiftStart.enabledThemePacks = enabledThemePacksProp;
      newStateForShiftStart.stabilityLevel = stabilityLevelProp;
      newStateForShiftStart.chaosLevel = chaosLevelProp;
      return [newStateForShiftStart, prevStack[1]];
    });

    if (!currentFullState.isAwaitingManualShiftThemeSelection && targetThemeName) {
      void loadInitialGame({ explicitThemeName: targetThemeName, isTransitioningFromShift: true, customGameFlag: previousCustomMode });
    }
  }, [
    getCurrentGameState,
    enabledThemePacksProp,
    summarizeAndStoreThemeHistory,
    loadInitialGame,
    setError,
    setLoadingReason,
    setGameStateStack,
    playerGenderProp,
    stabilityLevelProp,
    chaosLevelProp,
    isLoading
  ]);

  /** Executes a manual reality shift chosen by the player. */
  const executeManualRealityShift = useCallback(() => {
    const currentFullState = getCurrentGameState();
    const currentThemeObj = currentFullState.currentThemeObject;

    if (!currentThemeObj || isLoading) return;

    setError('MANUAL SHIFT! Reality destabilizes...');
    void summarizeAndStoreThemeHistory(currentThemeObj, currentFullState);

    if (currentFullState.isCustomGameMode) {
      setGameStateStack((prev: GameStateStack) => [{ ...prev[0], isAwaitingManualShiftThemeSelection: true, lastActionLog: 'You focus your will, preparing to choose a new reality...' }, prev[1]]);
    } else {
      triggerRealityShift(false);
    }
  }, [getCurrentGameState, summarizeAndStoreThemeHistory, triggerRealityShift, setError, setGameStateStack, isLoading]);

  /** Completes a manual shift with the selected theme. */
  const completeManualShiftWithSelectedTheme = useCallback((themeName: string) => {
    const currentFullState = getCurrentGameState();
    if (!currentFullState.isAwaitingManualShiftThemeSelection) return;

    setLoadingReason('reality_shift_load');
    setGameStateStack((prev: GameStateStack) => [{
      ...prev[0],
      isAwaitingManualShiftThemeSelection: false,
      pendingNewThemeNameAfterShift: themeName,
      lastActionLog: `You chose to shift reality to: ${themeName}. The world warps around you!`
    }, prev[1]]);

    void loadInitialGame({ explicitThemeName: themeName, isTransitioningFromShift: true, customGameFlag: true });
  }, [getCurrentGameState, setGameStateStack, loadInitialGame, setLoadingReason]);

  /** Cancels the manual shift selection process. */
  const cancelManualShiftThemeSelection = useCallback(() => {
    setGameStateStack((prev: GameStateStack) => [{ ...prev[0], isAwaitingManualShiftThemeSelection: false, lastActionLog: 'You decide against manually shifting reality for now.' }, prev[1]]);
    setError(null);
    setLoadingReason(null);
  }, [setGameStateStack, setError, setLoadingReason]);

  return {
    triggerRealityShift,
    executeManualRealityShift,
    completeManualShiftWithSelectedTheme,
    cancelManualShiftThemeSelection
  };
};
