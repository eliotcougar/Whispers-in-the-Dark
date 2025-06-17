/**
 * @file useModalState.ts
 * @description Centralizes visibility state for App modals.
 */
import { useState } from 'react';

export const useModalState = () => {
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

  return {
    isVisualizerVisible,
    setIsVisualizerVisible,
    visualizerImageUrl,
    setVisualizerImageUrl,
    visualizerImageScene,
    setVisualizerImageScene,
    isKnowledgeBaseVisible,
    setIsKnowledgeBaseVisible,
    isSettingsVisible,
    setIsSettingsVisible,
    isInfoVisible,
    setIsInfoVisible,
    isMapVisible,
    setIsMapVisible,
    userRequestedTitleMenuOpen,
    setUserRequestedTitleMenuOpen,
    shouldReturnToTitleMenu,
    setShouldReturnToTitleMenu,
    isHistoryVisible,
    setIsHistoryVisible,
    isDebugViewVisible,
    setIsDebugViewVisible,
    isCustomGameSetupVisible,
    setIsCustomGameSetupVisible,
    isManualShiftThemeSelectionVisible,
    setIsManualShiftThemeSelectionVisible,
    shiftConfirmOpen,
    setShiftConfirmOpen,
    newGameFromMenuConfirmOpen,
    setNewGameFromMenuConfirmOpen,
    loadGameFromMenuConfirmOpen,
    setLoadGameFromMenuConfirmOpen,
    newCustomGameConfirmOpen,
    setNewCustomGameConfirmOpen,
  } as const;
};
