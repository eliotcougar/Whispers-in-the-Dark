/**
 * @file useSaveLoad.ts
 * @description Hook managing save/load operations and related state for App.
 */
import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { FullGameState, ThemePackName } from '../types';
import {
  saveGameStateToFile,
  loadGameStateFromFile,
} from '../services/saveLoad';
import {
  saveGameStateToLocalStorage,
  loadGameStateFromLocalStorage,
} from '../services/storage';
import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_ENABLED_THEME_PACKS,
  DEFAULT_STABILITY_LEVEL,
  DEFAULT_CHAOS_LEVEL,
} from '../constants';

export interface UseSaveLoadOptions {
  gatherCurrentGameState?: () => FullGameState;
  applyLoadedGameState?: (opts: { savedStateToLoad: FullGameState }) => Promise<void>;
  setError?: Dispatch<SetStateAction<string | null>>;
  setIsLoading?: Dispatch<SetStateAction<boolean>>;
  isLoading?: boolean;
  dialogueState?: unknown;
  hasGameBeenInitialized?: boolean;
}

const AUTOSAVE_DEBOUNCE_TIME = 1500;

export const useSaveLoad = ({
  gatherCurrentGameState,
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
  const [initialSavedState, setInitialSavedState] = useState<FullGameState | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const loadedState = loadGameStateFromLocalStorage();
    if (loadedState) {
      setPlayerGender(loadedState.playerGender);
      setEnabledThemePacks(loadedState.enabledThemePacks);
      setStabilityLevel(loadedState.stabilityLevel);
      setChaosLevel(loadedState.chaosLevel);
      setInitialSavedState(loadedState);
    } else {
      setInitialSavedState(null);
    }
    setAppReady(true);
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
      if (gatherCurrentGameState) {
        const gameStateToSave = gatherCurrentGameState();
        saveGameStateToLocalStorage(
          gameStateToSave,
          setError ? (msg) => { setError(msg); } : undefined,
        );
      }
    }, AUTOSAVE_DEBOUNCE_TIME);

    return () => { if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current); };
  }, [
    gatherCurrentGameState,
    isLoading,
    hasGameBeenInitialized,
    appReady,
    dialogueState,
    setError,
  ]);

  const handleSaveToFile = useCallback(() => {
    if (isLoading || !!dialogueState) {
      setError?.('Cannot save to file while loading or in dialogue.');
      return;
    }
    if (gatherCurrentGameState) {
      const gameState = gatherCurrentGameState();
      saveGameStateToFile(
        gameState,
        setError ? (msg) => { setError(msg); } : undefined,
      );
    }
  }, [gatherCurrentGameState, isLoading, dialogueState, setError]);

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
      const loadedFullState = await loadGameStateFromFile(file);
      if (loadedFullState) {
        if (applyLoadedGameState) {
          await applyLoadedGameState({ savedStateToLoad: loadedFullState });
        }
        saveGameStateToLocalStorage(
          loadedFullState,
          setError ? (msg) => { setError(msg); } : undefined,
        );
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
    appReady,
    fileInputRef,
    handleSaveToFile,
    handleLoadFromFileClick,
    handleFileInputChange,
    updateSettingsFromLoad,
  } as const;
};
