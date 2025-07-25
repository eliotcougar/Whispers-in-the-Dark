/**
 * @file useAppModals.ts
 * @description Manages visibility state and helper handlers for app modals.
 */
import { useCallback, useState, useRef } from 'react';
import { clearProgress } from '../utils/loadingProgress';
import type { AdventureTheme, WorldFacts, CharacterOption, HeroSheet, HeroBackstory } from '../types';

export const useAppModals = () => {
  const [isVisualizerVisible, setIsVisualizerVisible] = useState(false);
  const [visualizerImageUrl, setVisualizerImageUrl] = useState<string | null>(null);
  const [visualizerImageScene, setVisualizerImageScene] = useState<string | null>(null);
  const [isKnowledgeBaseVisible, setIsKnowledgeBaseVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  const [isMapVisible, setIsMapVisible] = useState(false);
  const [userRequestedTitleMenuOpen, setUserRequestedTitleMenuOpen] = useState(false);
  const [shouldReturnToTitleMenu, setShouldReturnToTitleMenu] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isDebugViewVisible, setIsDebugViewVisible] = useState(false);
  const [isCustomGameSetupVisible, setIsCustomGameSetupVisible] = useState(false);
  const [isManualShiftThemeSelectionVisible, setIsManualShiftThemeSelectionVisible] = useState(false);
  const [shiftConfirmOpen, setShiftConfirmOpen] = useState(false);
  const [newGameFromMenuConfirmOpen, setNewGameFromMenuConfirmOpen] = useState(false);
  const [loadGameFromMenuConfirmOpen, setLoadGameFromMenuConfirmOpen] = useState(false);
  const [newCustomGameConfirmOpen, setNewCustomGameConfirmOpen] = useState(false);
  const [pageItemId, setPageItemId] = useState<string | null>(null);
  const [pageStartChapterIndex, setPageStartChapterIndex] = useState<number>(0);
  const [isPageVisible, setIsPageVisible] = useState(false);
  const [isDebugLoreVisible, setIsDebugLoreVisible] = useState(false);
  const [debugLoreFacts, setDebugLoreFacts] = useState<Array<string>>([]);
  const debugLoreResolveRef = useRef<((good: Array<string>, bad: Array<string>, proceed: boolean) => void) | null>(null);
  const [isCharacterSelectVisible, setIsCharacterSelectVisible] = useState(false);
  const [characterSelectData, setCharacterSelectData] = useState<{
    theme: AdventureTheme;
    playerGender: string;
    worldFacts: WorldFacts;
    options: Array<CharacterOption>;
  } | null>(null);
  const characterSelectResolveRef = useRef<((result: { name: string; heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null }) => void) | null>(null);

  const openVisualizer = useCallback(() => { setIsVisualizerVisible(true); }, []);
  const closeVisualizer = useCallback(() => { setIsVisualizerVisible(false); }, []);
  const openKnowledgeBase = useCallback(() => { setIsKnowledgeBaseVisible(true); }, []);
  const closeKnowledgeBase = useCallback(() => { setIsKnowledgeBaseVisible(false); }, []);
  const openMap = useCallback(() => { setIsMapVisible(true); }, []);
  const closeMap = useCallback(() => { setIsMapVisible(false); }, []);
  const openSettings = useCallback(() => { setIsSettingsVisible(true); }, []);
  const closeSettings = useCallback(() => { setIsSettingsVisible(false); }, []);
  const openInfo = useCallback(() => { setIsInfoVisible(true); }, []);
  const closeInfo = useCallback(() => { setIsInfoVisible(false); }, []);
  const openTitleMenu = useCallback(() => { setUserRequestedTitleMenuOpen(true); }, []);
  const closeTitleMenu = useCallback(() => { setUserRequestedTitleMenuOpen(false); }, []);
  const openHistory = useCallback(() => { setIsHistoryVisible(true); }, []);
  const closeHistory = useCallback(() => { setIsHistoryVisible(false); }, []);
  const closeDebugView = useCallback(() => { setIsDebugViewVisible(false); }, []);
  const openCustomGameSetup = useCallback(() => { setIsCustomGameSetupVisible(true); }, []);
  const closeCustomGameSetup = useCallback(() => { setIsCustomGameSetupVisible(false); }, []);
  const openManualShiftThemeSelection = useCallback(() => { setIsManualShiftThemeSelectionVisible(true); }, []);
  const closeManualShiftThemeSelection = useCallback(() => { setIsManualShiftThemeSelectionVisible(false); }, []);
  const openShiftConfirm = useCallback(() => { setShiftConfirmOpen(true); }, []);
  const closeShiftConfirm = useCallback(() => { setShiftConfirmOpen(false); }, []);
  const openNewGameFromMenuConfirm = useCallback(() => { setNewGameFromMenuConfirmOpen(true); }, []);
  const closeNewGameFromMenuConfirm = useCallback(() => { setNewGameFromMenuConfirmOpen(false); }, []);
  const openLoadGameFromMenuConfirm = useCallback(() => { setLoadGameFromMenuConfirmOpen(true); }, []);
  const closeLoadGameFromMenuConfirm = useCallback(() => { setLoadGameFromMenuConfirmOpen(false); }, []);
  const openNewCustomGameConfirm = useCallback(() => { setNewCustomGameConfirmOpen(true); }, []);
  const closeNewCustomGameConfirm = useCallback(() => { setNewCustomGameConfirmOpen(false); }, []);
  const openPageView = useCallback((id: string, startIndex = 0) => {
    setPageItemId(id);
    setPageStartChapterIndex(startIndex);
    setIsPageVisible(true);
  }, []);
  const closePageView = useCallback(() => {
    setIsPageVisible(false);
    setPageItemId(null);
    setPageStartChapterIndex(0);
    clearProgress();
  }, []);

  const openDebugLoreModal = useCallback((facts: Array<string>, resolve: (good: Array<string>, bad: Array<string>, proceed: boolean) => void) => {
    setDebugLoreFacts(facts);
    debugLoreResolveRef.current = resolve;
    setIsDebugLoreVisible(true);
  }, []);

  const submitDebugLoreModal = useCallback((good: Array<string>, bad: Array<string>, proceed: boolean) => {
    debugLoreResolveRef.current?.(good, bad, proceed);
    setIsDebugLoreVisible(false);
  }, []);

  const closeDebugLoreModal = useCallback(() => {
    debugLoreResolveRef.current?.([], [], false);
    setIsDebugLoreVisible(false);
  }, []);

  const openCharacterSelectModal = useCallback(
    (
      data: {
        theme: AdventureTheme;
        playerGender: string;
        worldFacts: WorldFacts;
        options: Array<CharacterOption>;
      },
      resolve: (result: { name: string; heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null }) => void,
    ) => {
      setCharacterSelectData(data);
      characterSelectResolveRef.current = resolve;
      setIsCharacterSelectVisible(true);
    },
    []
  );

  const submitCharacterSelectModal = useCallback(
    (result: { name: string; heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null }) => {
      characterSelectResolveRef.current?.(result);
      setIsCharacterSelectVisible(false);
      setCharacterSelectData(null);
    },
    []
  );

  return {
    // state
    isVisualizerVisible,
    visualizerImageUrl,
    visualizerImageScene,
    isKnowledgeBaseVisible,
    isSettingsVisible,
    isInfoVisible,
    isMapVisible,
    userRequestedTitleMenuOpen,
    shouldReturnToTitleMenu,
    isHistoryVisible,
    isDebugViewVisible,
    isCustomGameSetupVisible,
    isManualShiftThemeSelectionVisible,
    shiftConfirmOpen,
    newGameFromMenuConfirmOpen,
    loadGameFromMenuConfirmOpen,
   newCustomGameConfirmOpen,
   pageItemId,
   pageStartChapterIndex,
   isPageVisible,
    isCharacterSelectVisible,
    characterSelectData,
   // setters used outside
    setVisualizerImageUrl,
    setVisualizerImageScene,
    setShouldReturnToTitleMenu,
    setIsDebugViewVisible,
    // handlers
    openVisualizer,
    closeVisualizer,
    openKnowledgeBase,
    closeKnowledgeBase,
    openMap,
    closeMap,
    openSettings,
    closeSettings,
    openInfo,
    closeInfo,
    openTitleMenu,
    closeTitleMenu,
    openHistory,
    closeHistory,
    closeDebugView,
    openCustomGameSetup,
    closeCustomGameSetup,
    openManualShiftThemeSelection,
    closeManualShiftThemeSelection,
    openShiftConfirm,
    closeShiftConfirm,
    openNewGameFromMenuConfirm,
    closeNewGameFromMenuConfirm,
    openLoadGameFromMenuConfirm,
   closeLoadGameFromMenuConfirm,
   openNewCustomGameConfirm,
   closeNewCustomGameConfirm,
   openPageView,
   closePageView,
   isDebugLoreVisible,
   debugLoreFacts,
    openDebugLoreModal,
    submitDebugLoreModal,
    closeDebugLoreModal,
    openCharacterSelectModal,
    submitCharacterSelectModal,
  } as const;
};

export default useAppModals;
