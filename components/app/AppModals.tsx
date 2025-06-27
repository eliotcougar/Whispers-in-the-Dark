import KnowledgeBase from '../modals/KnowledgeBase';
import MapDisplay from '../map/MapDisplay';
import ConfirmationDialog from '../ConfirmationDialog';
import HistoryDisplay from '../modals/HistoryDisplay';
import ImageVisualizer from '../modals/ImageVisualizer';
import PageView from '../modals/PageView';
import { PLAYER_HOLDER_ID, PLAYER_JOURNAL_ID } from '../../constants';
import { useCallback } from 'react';
import {
  AdventureTheme,
  MapData,
  MapLayoutConfig,
  NPC,
  ThemeHistoryState,
  MapNode,
  Item,
  ItemChapter,
} from '../../types';

interface AppModalsProps {
  // Visibility flags
  readonly isVisualizerVisible: boolean;
  readonly onCloseVisualizer: () => void;
  readonly visualizerImageUrl: string | null;
  readonly visualizerImageScene: string | null;
  readonly setGeneratedImage: (url: string, scene: string) => void;
  readonly currentScene: string;
  readonly currentTheme: AdventureTheme;
  readonly mapData: MapData;
  readonly allNPCs: Array<NPC>;
  readonly localTime: string | null;
  readonly localEnvironment: string | null;
  readonly localPlace: string | null;

  readonly isKnowledgeBaseVisible: boolean;
  readonly onCloseKnowledgeBase: () => void;

  readonly isHistoryVisible: boolean;
  readonly onCloseHistory: () => void;
  readonly themeHistory: ThemeHistoryState;
  readonly gameLog: Array<string>;


  readonly isMapVisible: boolean;
  readonly onCloseMap: () => void;
  readonly currentThemeName: string | null;
  readonly currentMapNodeId: string | null;
  readonly destinationNodeId: string | null;
  readonly itemPresenceByNode: Record<string, { hasUseful: boolean; hasVehicle: boolean } | undefined>;
  readonly onSelectDestination: (id: string | null) => void;
  readonly initialLayoutConfig: MapLayoutConfig;
  readonly initialViewBox: string;
  readonly onViewBoxChange: (viewBox: string) => void;
  readonly onNodesPositioned: (nodes: Array<MapNode>) => void;
  readonly onLayoutConfigChange: (cfg: MapLayoutConfig) => void;

  readonly newGameFromMenuConfirmOpen: boolean;
  readonly handleConfirmNewGameFromMenu: () => void;
  readonly handleCancelNewGameFromMenu: () => void;
  readonly newCustomGameConfirmOpen: boolean;
  readonly handleConfirmNewCustomGame: () => void;
  readonly handleCancelNewCustomGame: () => void;
  readonly loadGameFromMenuConfirmOpen: boolean;
  readonly handleConfirmLoadGameFromMenu: () => void;
  readonly handleCancelLoadGameFromMenu: () => void;
  readonly shiftConfirmOpen: boolean;
  readonly handleConfirmShift: () => void;
  readonly handleCancelShift: () => void;
  readonly isCustomGameModeShift: boolean;
  readonly inventory: Array<Item>;
  readonly playerJournal: Array<ItemChapter>;
  readonly lastJournalWriteTurn: number;
  readonly pageItemId: string | null;
  readonly pageStartChapterIndex: number;
  readonly isPageVisible: boolean;
  readonly onClosePage: () => void;
  readonly storytellerThoughts: string;
  readonly currentQuest: string | null;
  readonly updateItemContent: (id: string, actual: string, visible: string, chapterIndex?: number) => void;
  readonly updatePlayerJournalContent: (actual: string, chapterIndex?: number) => void;
  readonly onItemInspect: (itemId: string) => void;
  readonly canInspectJournal: boolean;
  readonly onWriteJournal: () => void;
  readonly isWritingJournal: boolean;
  readonly canWriteJournal: boolean;
}

function AppModals({
  // Visibility flags
  isVisualizerVisible,
  onCloseVisualizer,
  visualizerImageUrl,
  visualizerImageScene,
  setGeneratedImage,
  currentScene,
  currentTheme,
  mapData,
  allNPCs,
  localTime,
  localEnvironment,
  localPlace,

  isKnowledgeBaseVisible,
  onCloseKnowledgeBase,

  isHistoryVisible,
  onCloseHistory,
  themeHistory,
  gameLog,

  isMapVisible,
  onCloseMap,
  currentThemeName,
  currentMapNodeId,
  destinationNodeId,
  itemPresenceByNode,
  onSelectDestination,
  initialLayoutConfig,
  initialViewBox,
  onViewBoxChange,
  onNodesPositioned,
  onLayoutConfigChange,

  newGameFromMenuConfirmOpen,
  handleConfirmNewGameFromMenu,
  handleCancelNewGameFromMenu,
  newCustomGameConfirmOpen,
  handleConfirmNewCustomGame,
  handleCancelNewCustomGame,
  loadGameFromMenuConfirmOpen,
  handleConfirmLoadGameFromMenu,
  handleCancelLoadGameFromMenu,
  shiftConfirmOpen,
  handleConfirmShift,
  handleCancelShift,
  isCustomGameModeShift,
  inventory,
  playerJournal,
  lastJournalWriteTurn,
  pageItemId,
  pageStartChapterIndex,
  isPageVisible,
  onClosePage,
  storytellerThoughts,
  currentQuest,
  updateItemContent,
  updatePlayerJournalContent,
  onItemInspect,
  canInspectJournal,
  onWriteJournal,
  canWriteJournal,
  isWritingJournal,
}: AppModalsProps) {

  const updateContentHandler = useCallback(
    (itemId: string, a: string, v: string, idx?: number) => {
      if (pageItemId === PLAYER_JOURNAL_ID) {
        updatePlayerJournalContent(a, idx);
      } else {
        updateItemContent(itemId, a, v, idx);
      }
    },
    [pageItemId, updateItemContent, updatePlayerJournalContent]
  );

  const inspectHandler = useCallback(() => {
    if (pageItemId) {
      onItemInspect(pageItemId);
      onClosePage();
    }
  }, [pageItemId, onItemInspect, onClosePage]);

  const writeJournalHandler = useCallback(() => {
    if (pageItemId === PLAYER_JOURNAL_ID) {
      onWriteJournal();
    }
  }, [pageItemId, onWriteJournal]);


  return (
    <>
      <ImageVisualizer
        allNPCs={allNPCs}
        cachedImageScene={visualizerImageScene}
        cachedImageUrl={visualizerImageUrl}
        currentSceneDescription={currentScene}
        currentTheme={currentTheme}
        isVisible={isVisualizerVisible}
        localEnvironment={localEnvironment}
        localPlace={localPlace}
        localTime={localTime}
        mapData={mapData.nodes}
        onClose={onCloseVisualizer}
        setGeneratedImage={setGeneratedImage}
      />

      <KnowledgeBase
        allNPCs={allNPCs}
        currentTheme={currentTheme}
        isVisible={isKnowledgeBaseVisible}
        onClose={onCloseKnowledgeBase}
      />

      <HistoryDisplay
        gameLog={gameLog}
        isVisible={isHistoryVisible}
        onClose={onCloseHistory}
        themeHistory={themeHistory}
      />

      <PageView
        allNPCs={allNPCs}
        canInspectJournal={canInspectJournal}
        canWriteJournal={canWriteJournal}
        currentQuest={currentQuest}
        currentScene={currentScene}
        currentTheme={currentTheme}
        isVisible={isPageVisible}
        isWritingJournal={isWritingJournal}
        item={
          pageItemId === PLAYER_JOURNAL_ID
            ? {
                id: PLAYER_JOURNAL_ID,
                name: 'Personal Journal',
                type: 'book',
                description: 'Your own journal',
                holderId: PLAYER_HOLDER_ID,
                chapters: playerJournal,
                lastWriteTurn: lastJournalWriteTurn,
                tags: [currentTheme.playerJournalStyle],
              }
            : inventory.find(it => it.id === pageItemId) ?? null
        }
        mapData={mapData}
        onClose={onClosePage}
        onInspect={pageItemId ? inspectHandler : undefined}
        onWriteJournal={pageItemId ? writeJournalHandler : undefined}
        startIndex={pageStartChapterIndex}
        storytellerThoughts={storytellerThoughts}
        updateItemContent={updateContentHandler}
      />

      <MapDisplay
        currentMapNodeId={currentMapNodeId}
        currentThemeName={currentThemeName}
        destinationNodeId={destinationNodeId}
        initialLayoutConfig={initialLayoutConfig}
        initialViewBox={initialViewBox}
        isVisible={isMapVisible}
        itemPresenceByNode={itemPresenceByNode}
        mapData={mapData}
        onClose={onCloseMap}
        onLayoutConfigChange={onLayoutConfigChange}
        onNodesPositioned={onNodesPositioned}
        onSelectDestination={onSelectDestination}
        onViewBoxChange={onViewBoxChange}
      />


      <ConfirmationDialog
        confirmPreset="red"
        confirmText="Start New Game"
        isOpen={newGameFromMenuConfirmOpen}
        message="Are you sure you want to start a new game? Your current progress will be lost."
        onCancel={handleCancelNewGameFromMenu}
        onConfirm={handleConfirmNewGameFromMenu}
        title="Confirm New Game"
      />

      <ConfirmationDialog
        confirmPreset="orange"
        confirmText="Start Custom Game"
        isOpen={newCustomGameConfirmOpen}
        message="Are you sure you want to start a new custom game? Your current progress will be lost."
        onCancel={handleCancelNewCustomGame}
        onConfirm={handleConfirmNewCustomGame}
        title="Confirm Custom Game"
      />

      <ConfirmationDialog
        confirmPreset="blue"
        confirmText="Load Game"
        isOpen={loadGameFromMenuConfirmOpen}
        message="Are you sure you want to load a game? Your current progress will be overwritten if you load a new game."
        onCancel={handleCancelLoadGameFromMenu}
        onConfirm={handleConfirmLoadGameFromMenu}
        title="Confirm Load Game"
      />

      <ConfirmationDialog
        confirmPreset="purple"
        confirmText="Shift Reality"
        isCustomModeShift={isCustomGameModeShift}
        isOpen={shiftConfirmOpen}
        message={<>
          This will destabilize the current reality, leading to an
          {' '}

          <strong className="text-purple-400">
            immediate and unpredictable shift
          </strong>

          {' '}
          to a new theme. Are you sure you wish to proceed?
        </>}
        onCancel={handleCancelShift}
        onConfirm={handleConfirmShift}
        title="Confirm Reality Shift"
      />
    </>
  );
}

export default AppModals;
