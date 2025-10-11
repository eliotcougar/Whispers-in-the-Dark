import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import DialogueDisplay from '../DialogueDisplay';
import DebugView from '../debug/DebugView';
import TitleMenu from '../modals/TitleMenu';
import GameSetupScreen from '../modals/GameSetupScreen';
import SettingsDisplay from '../modals/SettingsDisplay';
import InfoDisplay from '../modals/InfoDisplay';
import DebugLoreModal from '../modals/DebugLoreModal';
import GeminiKeyModal from '../modals/GeminiKeyModal';
import GenderSelectModal from '../modals/GenderSelectModal';
import ActIntroModal from '../modals/ActIntroModal';
import VictoryScreen from '../modals/VictoryScreen';
import CharacterSelectModal from '../modals/CharacterSelectModal';
import AppModals from './AppModals';
import type { MapData, MapLayoutConfig, MapNode, StoryAct } from '../../types';
import { applyNestedCircleLayout } from '../../utils/mapLayoutUtils';

type DialogueDisplayProps = ComponentProps<typeof DialogueDisplay>;
type DebugViewProps = ComponentProps<typeof DebugView>;
type TitleMenuProps = ComponentProps<typeof TitleMenu>;
type GameSetupScreenProps = ComponentProps<typeof GameSetupScreen>;
type SettingsDisplayProps = ComponentProps<typeof SettingsDisplay>;
type InfoDisplayProps = ComponentProps<typeof InfoDisplay>;
type DebugLoreModalProps = ComponentProps<typeof DebugLoreModal>;
type GeminiKeyModalProps = ComponentProps<typeof GeminiKeyModal>;
type GenderSelectModalProps = ComponentProps<typeof GenderSelectModal>;
type CharacterSelectModalProps = ComponentProps<typeof CharacterSelectModal>;
type AppModalsProps = ComponentProps<typeof AppModals>;
type VictoryScreenProps = ComponentProps<typeof VictoryScreen>;

interface ActIntroModalPayload extends ComponentProps<typeof ActIntroModal> {
  readonly act: StoryAct;
}

type TrimmedAppModalsProps = Omit<AppModalsProps, 'initialLayoutConfig' | 'initialViewBox' | 'onNodesPositioned'>;

interface AppModalManagerProps {
  readonly shouldLockBodyScroll: boolean;
  readonly dialogueDisplayProps: DialogueDisplayProps;
  readonly debugViewProps: DebugViewProps;
  readonly titleMenuProps: TitleMenuProps;
  readonly gameSetupProps: GameSetupScreenProps;
  readonly settingsDisplayProps: SettingsDisplayProps;
  readonly infoDisplayProps: InfoDisplayProps;
  readonly debugLoreModalProps: DebugLoreModalProps;
  readonly geminiKeyModalProps: GeminiKeyModalProps;
  readonly genderSelectModalProps: GenderSelectModalProps;
  readonly actIntroModalProps: ActIntroModalPayload | null;
  readonly victoryScreenProps: VictoryScreenProps | null;
  readonly characterSelectModalProps: CharacterSelectModalProps | null;
  readonly appModalsProps: TrimmedAppModalsProps | null;
  readonly mapLayoutConfig: MapLayoutConfig;
  readonly mapViewBox: string;
  readonly currentMapNodeId: string | null;
  readonly mapData: MapData;
  readonly onMapNodesPositioned: (nodes: Array<MapNode>) => void;
}

function AppModalManager({
  shouldLockBodyScroll,
  dialogueDisplayProps,
  debugViewProps,
  titleMenuProps,
  gameSetupProps,
  settingsDisplayProps,
  infoDisplayProps,
  debugLoreModalProps,
  geminiKeyModalProps,
  genderSelectModalProps,
  actIntroModalProps,
  victoryScreenProps,
  characterSelectModalProps,
  appModalsProps,
  mapLayoutConfig,
  mapViewBox,
  currentMapNodeId,
  mapData,
  onMapNodesPositioned,
}: AppModalManagerProps) {
  const [mapInitialViewBox, setMapInitialViewBox] = useState(mapViewBox);
  const wasMapVisibleRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const body = document.body;
    if (shouldLockBodyScroll) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollBarWidth > 0) {
        body.style.paddingRight = `${String(scrollBarWidth)}px`;
      }
    } else {
      body.style.overflow = '';
      body.style.paddingRight = '';
    }
    return () => {
      body.style.overflow = '';
      body.style.paddingRight = '';
    };
  }, [shouldLockBodyScroll]);

  useEffect(() => {
    if (!appModalsProps) return;
    const { isMapVisible } = appModalsProps;
    if (isMapVisible && !wasMapVisibleRef.current) {
      const layoutNodes = applyNestedCircleLayout(
        mapData.nodes.map(node => ({ ...node })),
        {
          padding: mapLayoutConfig.NESTED_PADDING,
          anglePadding: mapLayoutConfig.NESTED_ANGLE_PADDING,
        }
      );
      onMapNodesPositioned(layoutNodes);

      const parts = mapViewBox.split(' ').map(parseFloat);
      if (parts.length === 4) {
        const [, , vw, vh] = parts;
        const focusNode = layoutNodes.find(node => node.id === currentMapNodeId);
        if (focusNode && !Number.isNaN(vw) && !Number.isNaN(vh)) {
          setMapInitialViewBox(
            `${String(focusNode.position.x - vw / 2)} ${String(focusNode.position.y - vh / 2)} ${String(vw)} ${String(vh)}`
          );
        } else {
          setMapInitialViewBox(mapViewBox);
        }
      } else {
        setMapInitialViewBox(mapViewBox);
      }
    }

    wasMapVisibleRef.current = isMapVisible;
    if (!isMapVisible) {
      wasMapVisibleRef.current = false;
    }
  }, [
    appModalsProps,
    currentMapNodeId,
    mapData.nodes,
    mapLayoutConfig,
    mapViewBox,
    onMapNodesPositioned,
  ]);

  const mergedAppModalsProps = useMemo(() => {
    if (!appModalsProps) return null;
    return {
      ...appModalsProps,
      initialLayoutConfig: mapLayoutConfig,
      initialViewBox: mapInitialViewBox,
      onNodesPositioned: onMapNodesPositioned,
    };
  }, [appModalsProps, mapLayoutConfig, mapInitialViewBox, onMapNodesPositioned]);

  const {
    allNPCs: dialogueNPCs,
    heroShortName,
    history: dialogueHistory,
    inventory: dialogueInventory,
    isDialogueExiting,
    isLoading: dialogueIsLoading,
    isVisible: dialogueIsVisible,
    mapData: dialogueMapData,
    onClose: handleDialogueClose,
    onOptionSelect: handleDialogueOptionSelect,
    options: dialogueOptions,
    participants: dialogueParticipants,
  } = dialogueDisplayProps;

  const {
    badFacts,
    debugLore,
    debugPacket,
    gameStateStack,
    goodFacts,
    isVisible: isDebugVisible,
    onApplyGameState,
    onClearFacts,
    onClose: handleCloseDebugView,
    onDistillFacts,
    onSaveFacts,
    onSimulateVictory,
    onSpawnBook,
    onSpawnMap,
    onSpawnNpcAtLocation,
    onSpawnPage,
    onSpawnPicture,
    onSpawnVehicle,
    onToggleDebugLore,
    onTriggerMainQuestAchieved,
    onUndoTurn,
    travelPath,
  } = debugViewProps;

  const {
    isGameActive,
    isVisible: isTitleMenuVisible,
    onClose: handleTitleMenuClose,
    onLoadGame,
    onNewGame,
    onOpenGeminiKeyModal,
    onOpenInfo,
    onOpenSettings,
    onSaveGame,
  } = titleMenuProps;

  const {
    isVisible: isGameSetupVisible,
    onClose: handleGameSetupClose,
    onThemeSelected,
  } = gameSetupProps;

  const {
    enabledThemePacks,
    isVisible: isSettingsVisible,
    onChangePreferredPlayerName,
    onChangeThinkingEffort,
    onClose: handleSettingsClose,
    onToggleThemePack,
    preferredPlayerName,
    thinkingEffort,
  } = settingsDisplayProps;

  const {
    isVisible: isInfoVisible,
    onClose: handleInfoClose,
  } = infoDisplayProps;

  const {
    facts: debugFacts,
    isVisible: isDebugLoreVisible,
    onClose: handleDebugLoreClose,
    onSubmit: handleDebugLoreSubmit,
  } = debugLoreModalProps;

  const {
    isVisible: isGeminiKeyVisible,
    onClose: handleGeminiKeyClose,
  } = geminiKeyModalProps;

  const {
    defaultGender,
    isVisible: isGenderSelectVisible,
    onSubmit: handleGenderSubmit,
  } = genderSelectModalProps;

  let actIntroModalElement: ReactNode = null;
  if (actIntroModalProps) {
    const handleActIntroContinue = actIntroModalProps.onContinue;
    actIntroModalElement = (
      <ActIntroModal
        act={actIntroModalProps.act}
        isTurnGenerating={actIntroModalProps.isTurnGenerating}
        onContinue={handleActIntroContinue}
      />
    );
  }

  let victoryScreenElement: ReactNode = null;
  if (victoryScreenProps) {
    const handleVictoryClose = victoryScreenProps.onClose;
    victoryScreenElement = (
      <VictoryScreen
        heroSheet={victoryScreenProps.heroSheet}
        onClose={handleVictoryClose}
        storyArc={victoryScreenProps.storyArc}
      />
    );
  }

  let characterSelectModalElement: ReactNode = null;
  if (characterSelectModalProps) {
    const handleCharacterComplete = characterSelectModalProps.onComplete;
    const handleCharacterHeroData = characterSelectModalProps.onHeroData;
    characterSelectModalElement = (
      <CharacterSelectModal
        WorldSheet={characterSelectModalProps.WorldSheet}
        heroGender={characterSelectModalProps.heroGender}
        isVisible={characterSelectModalProps.isVisible}
        onComplete={handleCharacterComplete}
        onHeroData={handleCharacterHeroData}
        options={characterSelectModalProps.options}
        theme={characterSelectModalProps.theme}
      />
    );
  }

  let appModalsElement: ReactNode = null;
  if (mergedAppModalsProps) {
    const {
      adventureName,
      allNPCs: modalNPCs,
      canInspectJournal,
      canWriteJournal,
      currentMapNodeId: modalCurrentMapNodeId,
      currentQuest,
      currentScene: modalCurrentScene,
      destinationNodeId: modalDestinationNodeId,
      handleCancelLoadGameFromMenu,
      handleCancelNewGameFromMenu,
      handleConfirmLoadGameFromMenu,
      handleConfirmNewGameFromMenu,
      initialLayoutConfig,
      initialViewBox,
      inventory: modalInventory,
      isKnowledgeBaseVisible: modalIsKnowledgeBaseVisible,
      isMapVisible: modalIsMapVisible,
      isPageVisible: modalIsPageVisible,
      isVisualizerVisible: modalIsVisualizerVisible,
      isWritingJournal: modalIsWritingJournal,
      itemPresenceByNode,
      lastJournalWriteTurn: modalLastJournalWriteTurn,
      loadGameFromMenuConfirmOpen: modalLoadGameConfirmOpen,
      localEnvironment: modalLocalEnvironment,
      localPlace: modalLocalPlace,
      localTime: modalLocalTime,
      mapData: modalMapData,
      newGameFromMenuConfirmOpen: modalNewGameConfirmOpen,
      onCloseKnowledgeBase,
      onCloseMap,
      onClosePage,
      onCloseVisualizer,
      onItemInspect: handleItemInspect,
      onLayoutConfigChange: handleLayoutConfigChange,
      onNodesPositioned: handleNodesPositioned,
      onSelectDestination: handleSelectDestination,
      onViewBoxChange: handleViewBoxChange,
      onWriteJournal: handleWriteJournal,
      pageItemId,
      pageStartChapterIndex,
      playerJournal: modalPlayerJournal,
      setGeneratedImage: handleSetGeneratedImage,
      storytellerThoughts,
      theme: modalTheme,
      updateItemContent: handleUpdateItemContent,
      updatePlayerJournalContent: handleUpdatePlayerJournalContent,
      visualizerImageScene,
      visualizerImageUrl,
    } = mergedAppModalsProps;

    appModalsElement = (
      <AppModals
        adventureName={adventureName}
        allNPCs={modalNPCs}
        canInspectJournal={canInspectJournal}
        canWriteJournal={canWriteJournal}
        currentMapNodeId={modalCurrentMapNodeId}
        currentQuest={currentQuest}
        currentScene={modalCurrentScene}
        destinationNodeId={modalDestinationNodeId}
        handleCancelLoadGameFromMenu={handleCancelLoadGameFromMenu}
        handleCancelNewGameFromMenu={handleCancelNewGameFromMenu}
        handleConfirmLoadGameFromMenu={handleConfirmLoadGameFromMenu}
        handleConfirmNewGameFromMenu={handleConfirmNewGameFromMenu}
        initialLayoutConfig={initialLayoutConfig}
        initialViewBox={initialViewBox}
        inventory={modalInventory}
        isKnowledgeBaseVisible={modalIsKnowledgeBaseVisible}
        isMapVisible={modalIsMapVisible}
        isPageVisible={modalIsPageVisible}
        isVisualizerVisible={modalIsVisualizerVisible}
        isWritingJournal={modalIsWritingJournal}
        itemPresenceByNode={itemPresenceByNode}
        lastJournalWriteTurn={modalLastJournalWriteTurn}
        loadGameFromMenuConfirmOpen={modalLoadGameConfirmOpen}
        localEnvironment={modalLocalEnvironment}
        localPlace={modalLocalPlace}
        localTime={modalLocalTime}
        mapData={modalMapData}
        newGameFromMenuConfirmOpen={modalNewGameConfirmOpen}
        onCloseKnowledgeBase={onCloseKnowledgeBase}
        onCloseMap={onCloseMap}
        onClosePage={onClosePage}
        onCloseVisualizer={onCloseVisualizer}
        onItemInspect={handleItemInspect}
        onLayoutConfigChange={handleLayoutConfigChange}
        onNodesPositioned={handleNodesPositioned}
        onSelectDestination={handleSelectDestination}
        onViewBoxChange={handleViewBoxChange}
        onWriteJournal={handleWriteJournal}
        pageItemId={pageItemId}
        pageStartChapterIndex={pageStartChapterIndex}
        playerJournal={modalPlayerJournal}
        setGeneratedImage={handleSetGeneratedImage}
        storytellerThoughts={storytellerThoughts}
        theme={modalTheme}
        updateItemContent={handleUpdateItemContent}
        updatePlayerJournalContent={handleUpdatePlayerJournalContent}
        visualizerImageScene={visualizerImageScene}
        visualizerImageUrl={visualizerImageUrl}
      />
    );
  }

  return (
    <>
      <DialogueDisplay
        allNPCs={dialogueNPCs}
        heroShortName={heroShortName}
        history={dialogueHistory}
        inventory={dialogueInventory}
        isDialogueExiting={isDialogueExiting}
        isLoading={dialogueIsLoading}
        isVisible={dialogueIsVisible}
        mapData={dialogueMapData}
        onClose={handleDialogueClose}
        onOptionSelect={handleDialogueOptionSelect}
        options={dialogueOptions}
        participants={dialogueParticipants}
      />

      <DebugView
        badFacts={badFacts}
        debugLore={debugLore}
        debugPacket={debugPacket}
        gameStateStack={gameStateStack}
        goodFacts={goodFacts}
        isVisible={isDebugVisible}
        onApplyGameState={onApplyGameState}
        onClearFacts={onClearFacts}
        onClose={handleCloseDebugView}
        onDistillFacts={onDistillFacts}
        onSaveFacts={onSaveFacts}
        onSimulateVictory={onSimulateVictory}
        onSpawnBook={onSpawnBook}
        onSpawnMap={onSpawnMap}
        onSpawnNpcAtLocation={onSpawnNpcAtLocation}
        onSpawnPage={onSpawnPage}
        onSpawnPicture={onSpawnPicture}
        onSpawnVehicle={onSpawnVehicle}
        onToggleDebugLore={onToggleDebugLore}
        onTriggerMainQuestAchieved={onTriggerMainQuestAchieved}
        onUndoTurn={onUndoTurn}
        travelPath={travelPath}
      />

      <TitleMenu
        isGameActive={isGameActive}
        isVisible={isTitleMenuVisible}
        onClose={handleTitleMenuClose}
        onLoadGame={onLoadGame}
        onNewGame={onNewGame}
        onOpenGeminiKeyModal={onOpenGeminiKeyModal}
        onOpenInfo={onOpenInfo}
        onOpenSettings={onOpenSettings}
        onSaveGame={onSaveGame}
      />

      <GameSetupScreen
        isVisible={isGameSetupVisible}
        onClose={handleGameSetupClose}
        onThemeSelected={onThemeSelected}
      />

      <SettingsDisplay
        enabledThemePacks={enabledThemePacks}
        isVisible={isSettingsVisible}
        onChangePreferredPlayerName={onChangePreferredPlayerName}
        onChangeThinkingEffort={onChangeThinkingEffort}
        onClose={handleSettingsClose}
        onToggleThemePack={onToggleThemePack}
        preferredPlayerName={preferredPlayerName}
        thinkingEffort={thinkingEffort}
      />

      <InfoDisplay
        isVisible={isInfoVisible}
        onClose={handleInfoClose}
      />

      <DebugLoreModal
        facts={debugFacts}
        isVisible={isDebugLoreVisible}
        onClose={handleDebugLoreClose}
        onSubmit={handleDebugLoreSubmit}
      />

      <GeminiKeyModal
        isVisible={isGeminiKeyVisible}
        onClose={handleGeminiKeyClose}
      />

      <GenderSelectModal
        defaultGender={defaultGender}
        isVisible={isGenderSelectVisible}
        onSubmit={handleGenderSubmit}
      />

      {actIntroModalElement}

      {victoryScreenElement}

      {characterSelectModalElement}

      {appModalsElement}
    </>
  );
}

export default AppModalManager;
