import KnowledgeBase from '../modals/KnowledgeBase';
import MapDisplay from '../map/MapDisplay';
import ConfirmationDialog from '../ConfirmationDialog';
import ImageVisualizer from '../modals/ImageVisualizer';
import PageView from '../modals/PageView';
import { PLAYER_HOLDER_ID, PLAYER_JOURNAL_ID } from '../../constants';
import { useCallback } from 'react';
import {
  AdventureTheme,
  MapData,
  MapLayoutConfig,
  NPC,
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
  readonly theme: AdventureTheme;
  readonly mapData: MapData;
  readonly allNPCs: Array<NPC>;
  readonly localTime: string;
  readonly localEnvironment: string;
  readonly localPlace: string;

  readonly isKnowledgeBaseVisible: boolean;
  readonly onCloseKnowledgeBase: () => void;



  readonly isMapVisible: boolean;
  readonly onCloseMap: () => void;
  readonly adventureName: string | null;
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
  readonly loadGameFromMenuConfirmOpen: boolean;
  readonly handleConfirmLoadGameFromMenu: () => void;
  readonly handleCancelLoadGameFromMenu: () => void;
  readonly inventory: Array<Item>;
  readonly playerJournal: Array<ItemChapter>;
  readonly lastJournalWriteTurn: number;
  readonly pageItemId: string | null;
  readonly pageStartChapterIndex: number;
  readonly isPageVisible: boolean;
  readonly onClosePage: () => void;
  readonly storytellerThoughts: string;
  readonly currentQuest: string | null;
  readonly updateItemContent: (
    id: string,
    actual?: string,
    visible?: string,
    chapterIndex?: number,
    imageData?: string,
  ) => void;
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
  theme,
  mapData,
  allNPCs,
  localTime,
  localEnvironment,
  localPlace,

  isKnowledgeBaseVisible,
  onCloseKnowledgeBase,

  isMapVisible,
  onCloseMap,
  adventureName,
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
  loadGameFromMenuConfirmOpen,
  handleConfirmLoadGameFromMenu,
  handleCancelLoadGameFromMenu,
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
    (
      itemId: string,
      a?: string,
      v?: string,
      idx?: number,
      img?: string,
    ) => {
      if (pageItemId === PLAYER_JOURNAL_ID) {
        updatePlayerJournalContent(a ?? '', idx);
      } else {
        updateItemContent(itemId, a, v, idx, img);
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
        theme={theme}
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
        theme={theme}
        isVisible={isKnowledgeBaseVisible}
        onClose={onCloseKnowledgeBase}
      />


      <PageView
        allNPCs={allNPCs}
        canInspectJournal={canInspectJournal}
        canWriteJournal={canWriteJournal}
        currentQuest={currentQuest}
        currentScene={currentScene}
        theme={theme}
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
                tags: [theme.playerJournalStyle],
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
        adventureName={adventureName}
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
        confirmPreset="blue"
        confirmText="Load Game"
        isOpen={loadGameFromMenuConfirmOpen}
        message="Are you sure you want to load a game? Your current progress will be overwritten if you load a new game."
        onCancel={handleCancelLoadGameFromMenu}
        onConfirm={handleConfirmLoadGameFromMenu}
        title="Confirm Load Game"
      />

    </>
  );
}

export default AppModals;
