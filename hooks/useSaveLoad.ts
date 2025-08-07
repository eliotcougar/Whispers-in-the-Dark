/**
 * @file useSaveLoad.ts
 * @description Hook managing save/load operations and related state for App.
 */
import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { ThemePackName, GameStateStack, DebugPacketStack, ThinkingEffort } from '../types';
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

export interface UseSaveLoadOptions {
  gatherGameStateStack?: () => GameStateStack;
  gatherDebugPacketStack?: () => DebugPacketStack;
  applyLoadedGameState?: (opts: {
    savedStateToLoad: GameStateStack;
    clearImages?: boolean;
  }) => Promise<void>;
  setError?: Dispatch<SetStateAction<string | null>>;
  setIsLoading?: Dispatch<SetStateAction<boolean>>;
  isLoading?: boolean;
  dialogueState?: unknown;
  hasGameBeenInitialized?: boolean;
}

const AUTOSAVE_DEBOUNCE_TIME = 1500;

export const useSaveLoad = ({
  gatherGameStateStack,
  gatherDebugPacketStack,
  applyLoadedGameState,
  setError,
  setIsLoading,
  isLoading = false,
  dialogueState = null,
  hasGameBeenInitialized = false,
}: UseSaveLoadOptions) => {
  const [enabledThemePacks, setEnabledThemePacks] = useState<Array<ThemePackName>>([...DEFAULT_ENABLED_THEME_PACKS]);
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>('Medium');
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
      if (loadedState) {
        if (loadedDebug) setInitialDebugStack(loadedDebug);
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
    saveSettingsToLocalStorage({ enabledThemePacks, thinkingEffort });
  }, [enabledThemePacks, thinkingEffort]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading || !hasGameBeenInitialized || !appReady || !!dialogueState) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

    autosaveTimeoutRef.current = window.setTimeout(() => {
      if (gatherGameStateStack && gatherDebugPacketStack) {
        const stack = gatherGameStateStack();
        const debugStack = gatherDebugPacketStack();
        saveGameStateToLocalStorage(
          stack,
          setError ? (msg) => { setError(msg); } : undefined,
        );
        saveDebugPacketStackToLocalStorage(debugStack);
        saveDebugLoreToLocalStorage({
          debugLore: stack[0].debugLore,
          debugGoodFacts: stack[0].debugGoodFacts,
          debugBadFacts: stack[0].debugBadFacts,
        });
      }
    }, AUTOSAVE_DEBOUNCE_TIME);

    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [
    gatherGameStateStack,
    gatherDebugPacketStack,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    setError,
  ]);

  const handleSaveToFile = useCallback(async () => {
    if (isLoading || !!dialogueState) {
      setError?.('Cannot save to file while loading or in dialogue.');
      return;
    }
    if (gatherGameStateStack && gatherDebugPacketStack) {
      const gameState = gatherGameStateStack();
      const debugStack = gatherDebugPacketStack();
      await saveGameStateToFile(
        gameState,
        debugStack,
        setError ? msg => { setError(msg); } : undefined,
      );
    }
  }, [gatherGameStateStack, gatherDebugPacketStack, isLoading, dialogueState, setError]);

  const handleLoadFromFileClick = () => {
    if (isLoading || !!dialogueState) {
      setError?.('Cannot load from file while another operation is in progress or while in dialogue.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading || !!dialogueState) {
      setError?.('Cannot load from file while another operation is in progress or while in dialogue.');
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading?.(true);
      setError?.(null);
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
        if (applyLoadedGameState) {
          await applyLoadedGameState({ savedStateToLoad: mergedStack });
        }
        saveGameStateToLocalStorage(
          mergedStack,
          setError ? (msg) => { setError(msg); } : undefined,
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
        setError?.('Failed to load game from file. The file might be corrupted, an incompatible version, or not a valid save file.');
      }
      setIsLoading?.(false);
    }
    event.target.value = '';
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFileSelected(event);
  };

  return {
    enabledThemePacks,
    setEnabledThemePacks,
    thinkingEffort,
    setThinkingEffort,
    initialSavedState,
    initialDebugStack,
    appReady,
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
  } as const;
};
