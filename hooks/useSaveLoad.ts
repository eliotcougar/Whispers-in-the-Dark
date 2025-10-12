/**
 * @file useSaveLoad.ts
 * @description Hooks managing save/load state and interactions for the App shell.
 */
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  ThemePackName,
  GameStateStack,
  DebugPacketStack,
  ThinkingEffort,
} from '../types';
import {
  saveGameStateToFile,
  loadGameStateFromFile,
} from '../services/saveLoad';
import { clearAllImages } from '../services/imageDb';
import {
  saveGameStateToLocalStorage,
  loadGameStateFromLocalStorageWithImages,
  saveDebugPacketStackToLocalStorage,
  loadDebugPacketStackFromLocalStorage,
  saveDebugLoreToLocalStorage,
  loadDebugLoreFromLocalStorage,
  saveSettingsToLocalStorage,
  loadSettingsFromLocalStorage,
} from '../services/storage';
import { DEFAULT_ENABLED_THEME_PACKS } from '../constants';
import { setThinkingEffortLevel } from '../services/thinkingConfig';
import { sanitizePlayerName } from '../utils/textSanitizers';
import { useGameLogicContext } from './useGameLogicContext';

export interface SaveLoadState {
  readonly enabledThemePacks: Array<ThemePackName>;
  readonly setEnabledThemePacks: Dispatch<SetStateAction<Array<ThemePackName>>>;
  readonly thinkingEffort: ThinkingEffort;
  readonly setThinkingEffort: Dispatch<SetStateAction<ThinkingEffort>>;
  readonly preferredPlayerName: string;
  readonly setPreferredPlayerName: Dispatch<SetStateAction<string>>;
  readonly initialSavedState: GameStateStack | null;
  readonly initialDebugStack: DebugPacketStack | null;
  readonly appReady: boolean;
}

export const useSaveLoadState = (): SaveLoadState => {
  const [enabledThemePacks, setEnabledThemePacks] = useState<Array<ThemePackName>>(
    [...DEFAULT_ENABLED_THEME_PACKS],
  );
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>('Medium');
  const [preferredPlayerName, setPreferredPlayerName] = useState<string>('');
  const [initialSavedState, setInitialSavedState] = useState<GameStateStack | null>(null);
  const [initialDebugStack, setInitialDebugStack] = useState<DebugPacketStack | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const loadedState = await loadGameStateFromLocalStorageWithImages();
      const loadedDebug = loadDebugPacketStackFromLocalStorage();
      const loadedDebugLore = loadDebugLoreFromLocalStorage();
      const loadedSettings = loadSettingsFromLocalStorage();

      setEnabledThemePacks(loadedSettings.enabledThemePacks);
      setThinkingEffort(loadedSettings.thinkingEffort);
      setPreferredPlayerName(loadedSettings.preferredPlayerName ?? '');

      if (loadedState) {
        if (loadedDebug) {
          setInitialDebugStack(loadedDebug);
        }
        if (loadedDebugLore) {
          loadedState[0].debugLore = loadedDebugLore.debugLore;
          loadedState[0].debugGoodFacts = loadedDebugLore.debugGoodFacts;
          loadedState[0].debugBadFacts = loadedDebugLore.debugBadFacts;
        }

        const { thinkingEffort: effort, enabledThemePacks: packs } = loadedSettings;
        loadedState[0].thinkingEffort = effort;
        loadedState[0].enabledThemePacks = packs;
        if (loadedState[1]) {
          loadedState[1].thinkingEffort = effort;
          loadedState[1].enabledThemePacks = packs;
        }

        setInitialSavedState(loadedState);
      } else {
        setInitialSavedState(null);
      }

      setAppReady(true);
    })();
  }, []);

  useEffect(() => {
    setThinkingEffortLevel(thinkingEffort);
    const sanitized = sanitizePlayerName(preferredPlayerName);
    saveSettingsToLocalStorage({
      enabledThemePacks,
      thinkingEffort,
      preferredPlayerName: sanitized,
    });
  }, [enabledThemePacks, thinkingEffort, preferredPlayerName]);

  return {
    enabledThemePacks,
    setEnabledThemePacks,
    thinkingEffort,
    setThinkingEffort,
    preferredPlayerName,
    setPreferredPlayerName,
    initialSavedState,
    initialDebugStack,
    appReady,
  };
};

interface UseSaveLoadActionsOptions {
  readonly enabledThemePacks: Array<ThemePackName>;
  readonly thinkingEffort: ThinkingEffort;
}

export const useSaveLoadActions = ({
  enabledThemePacks,
  thinkingEffort,
}: UseSaveLoadActionsOptions) => {
  const {
    status,
    dialogue,
    debug,
    system,
  } = useGameLogicContext();
  const { isLoading } = status;
  const { state: dialogueState } = dialogue;
  const {
    gatherCurrentGameState,
    gatherDebugPacketStack,
  } = debug;
  const {
    setError,
    setIsLoading,
    applyLoadedGameState,
  } = system;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveToFile = useCallback(async () => {
    if (isLoading || dialogueState) {
      setError('Cannot save to file while loading or in dialogue.');
      return;
    }

    const gameState = gatherCurrentGameState();
    const debugStack = gatherDebugPacketStack();
    await saveGameStateToFile(
      gameState,
      debugStack,
      msg => { setError(msg); },
    );
  }, [dialogueState, gatherCurrentGameState, gatherDebugPacketStack, isLoading, setError]);

  const handleLoadFromFileClick = useCallback(() => {
    if (isLoading || dialogueState) {
      setError('Cannot load from file while another operation is in progress or while in dialogue.');
      return;
    }
    fileInputRef.current?.click();
  }, [dialogueState, isLoading, setError]);

  const handleFileSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (isLoading || dialogueState) {
      setError('Cannot load from file while another operation is in progress or while in dialogue.');
      event.target.value = '';
      return;
    }

    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      setError(null);
      await clearAllImages();
      const loaded = await loadGameStateFromFile(file);
      if (loaded) {
        const { gameStateStack: loadedStack, debugPacketStack: loadedDebug } = loaded;
        const mergedStack: GameStateStack = [
          { ...loadedStack[0], enabledThemePacks, thinkingEffort },
          loadedStack[1]
            ? { ...loadedStack[1], enabledThemePacks, thinkingEffort }
            : undefined,
        ];
        const existingLore = loadDebugLoreFromLocalStorage();
        if (existingLore) {
          mergedStack[0].debugLore = existingLore.debugLore;
          mergedStack[0].debugGoodFacts = existingLore.debugGoodFacts;
          mergedStack[0].debugBadFacts = existingLore.debugBadFacts;
        }
        await applyLoadedGameState({ savedStateToLoad: mergedStack });
        saveGameStateToLocalStorage(
          mergedStack,
          msg => { setError(msg); },
        );
        saveDebugPacketStackToLocalStorage(loadedDebug);
        if (existingLore) {
          saveDebugLoreToLocalStorage(existingLore);
        } else {
          saveDebugLoreToLocalStorage({
            debugLore: mergedStack[0].debugLore,
            debugGoodFacts: mergedStack[0].debugGoodFacts,
            debugBadFacts: mergedStack[0].debugBadFacts,
          });
        }
      } else {
        setError(
          'Failed to load game from file. The file might be corrupted, an incompatible version, or not a valid save file.',
        );
      }
      setIsLoading(false);
    }
    event.target.value = '';
  }, [
    applyLoadedGameState,
    dialogueState,
    enabledThemePacks,
    isLoading,
    setError,
    setIsLoading,
    thinkingEffort,
  ]);

  const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    void handleFileSelected(event);
  }, [handleFileSelected]);

  return {
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
  } as const;
};
