/**
 * @file useSaveLoad.ts
 * @description Hook managing save/load operations and related state for App.
 */
import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { FullGameState, ThemePackName, GameStateStack, DebugPacketStack } from '../types';
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
} from '../services/storage';
import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_ENABLED_THEME_PACKS,
  DEFAULT_STABILITY_LEVEL,
  DEFAULT_CHAOS_LEVEL,
} from '../constants';

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
  const [playerGender, setPlayerGender] = useState<string>(DEFAULT_PLAYER_GENDER);
  const [enabledThemePacks, setEnabledThemePacks] = useState<Array<ThemePackName>>([...DEFAULT_ENABLED_THEME_PACKS]);
  const [stabilityLevel, setStabilityLevel] = useState<number>(DEFAULT_STABILITY_LEVEL);
  const [chaosLevel, setChaosLevel] = useState<number>(DEFAULT_CHAOS_LEVEL);
  const [initialSavedState, setInitialSavedState] = useState<GameStateStack | null>(null);
  const [initialDebugStack, setInitialDebugStack] = useState<DebugPacketStack | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const loadedState = await loadGameStateFromLocalStorageWithImages();
      const loadedDebug = loadDebugPacketStackFromLocalStorage();
      const loadedDebugLore = loadDebugLoreFromLocalStorage();
      if (loadedState) {
        if (loadedDebug) setInitialDebugStack(loadedDebug);
        if (loadedDebugLore) {
          loadedState[0].debugLore = loadedDebugLore.debugLore;
          loadedState[0].debugGoodFacts = loadedDebugLore.debugGoodFacts;
          loadedState[0].debugBadFacts = loadedDebugLore.debugBadFacts;
        }
        const current = loadedState[0];
        setPlayerGender(current.playerGender);
        setEnabledThemePacks(current.enabledThemePacks);
        setStabilityLevel(current.stabilityLevel);
        setChaosLevel(current.chaosLevel);
        setInitialSavedState(loadedState);
      } else {
        setInitialSavedState(null);
      }
      setAppReady(true);
    })();
  }, []);

  const updateSettingsFromLoad = useCallback((loadedSettings: Partial<Pick<FullGameState, 'playerGender' | 'enabledThemePacks' | 'stabilityLevel' | 'chaosLevel'>>) => {
    if (loadedSettings.playerGender !== undefined) setPlayerGender(loadedSettings.playerGender);
    if (loadedSettings.enabledThemePacks !== undefined) setEnabledThemePacks(loadedSettings.enabledThemePacks);
    if (loadedSettings.stabilityLevel !== undefined) setStabilityLevel(loadedSettings.stabilityLevel);
    if (loadedSettings.chaosLevel !== undefined) setChaosLevel(loadedSettings.chaosLevel);
  }, []);

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
        const existingLore = loadDebugLoreFromLocalStorage();
        if (existingLore) {
          loadedStack[0].debugLore = existingLore.debugLore;
          loadedStack[0].debugGoodFacts = existingLore.debugGoodFacts;
          loadedStack[0].debugBadFacts = existingLore.debugBadFacts;
        }
        if (applyLoadedGameState) {
          await applyLoadedGameState({ savedStateToLoad: loadedStack });
        }
        saveGameStateToLocalStorage(
          loadedStack,
          setError ? (msg) => { setError(msg); } : undefined,
        );
        saveDebugPacketStackToLocalStorage(loadedDebug);
        if (existingLore) {
          saveDebugLoreToLocalStorage(existingLore);
        } else {
          saveDebugLoreToLocalStorage({
            debugLore: loadedStack[0].debugLore,
            debugGoodFacts: loadedStack[0].debugGoodFacts,
            debugBadFacts: loadedStack[0].debugBadFacts,
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
    playerGender,
    setPlayerGender,
    enabledThemePacks,
    setEnabledThemePacks,
    stabilityLevel,
    setStabilityLevel,
    chaosLevel,
    setChaosLevel,
    initialSavedState,
    initialDebugStack,
    appReady,
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
    updateSettingsFromLoad,
  } as const;
};
