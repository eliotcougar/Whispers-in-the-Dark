import { useCallback, useState } from 'react';

import { useGameLogic } from '../../hooks/useGameLogic';
import { GameLogicProvider } from '../../hooks/useGameLogicContext';
import { useSaveLoadState } from '../../hooks/useSaveLoad';
import { useAppModals } from '../../hooks/useAppModals';
import AppContent from './AppContent';
import type {
  AdventureTheme,
  CharacterOption,
  HeroBackstory,
  HeroSheet,
  StoryAct,
  StoryArc,
  WorldSheet,
} from '../../types';

function App() {
  const saveLoadState = useSaveLoadState();
  const appModals = useAppModals();
  const {
    openCharacterSelectModal,
    openGenderSelectModal,
    openDebugLoreModal,
  } = appModals;
  const [pendingAct, setPendingAct] = useState<StoryAct | null>(null);

  const openCharacterSelect = useCallback(
    (
      data: {
        theme: AdventureTheme;
        heroGender: string;
        WorldSheet: WorldSheet;
        options: Array<CharacterOption>;
      },
      onHeroData: (result: {
        name: string;
        heroSheet: HeroSheet | null;
        heroBackstory: HeroBackstory | null;
        storyArc: StoryArc | null;
      }) => Promise<void>,
    ) =>
      new Promise<void>(resolve => {
        openCharacterSelectModal(data, onHeroData, resolve);
      }),
    [openCharacterSelectModal],
  );

  const openGenderSelect = useCallback(
    (defaultGender: string) =>
      new Promise<string>(resolve => {
        openGenderSelectModal(defaultGender, resolve);
      }),
    [openGenderSelectModal],
  );

  const gameLogic = useGameLogic({
    enabledThemePacksProp: saveLoadState.enabledThemePacks,
    thinkingEffortProp: saveLoadState.thinkingEffort,
    preferredPlayerNameProp: saveLoadState.preferredPlayerName,
    initialSavedStateFromApp: saveLoadState.initialSavedState,
    initialDebugStackFromApp: saveLoadState.initialDebugStack,
    isAppReady: saveLoadState.appReady,
    openDebugLoreModal,
    openCharacterSelectModal: openCharacterSelect,
    openGenderSelectModal: openGenderSelect,
    onActIntro: setPendingAct,
  });

  return (
    <GameLogicProvider value={gameLogic}>
      <AppContent
        appModals={appModals}
        pendingAct={pendingAct}
        saveLoadState={saveLoadState}
        setPendingAct={setPendingAct}
      />
    </GameLogicProvider>
  );
}

export default App;
