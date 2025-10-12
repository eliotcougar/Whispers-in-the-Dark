import KnowledgeBase from '../modals/KnowledgeBase';
import MapDisplay from '../map/MapDisplay';
import ConfirmationDialog from '../ConfirmationDialog';
import ImageVisualizer from '../modals/ImageVisualizer';
import PageView from '../modals/PageView';
import { PLAYER_HOLDER_ID, PLAYER_JOURNAL_ID } from '../../constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
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
  const [shouldRenderMap, setShouldRenderMap] = useState(isMapVisible);
  const [mapVisibleForAnimation, setMapVisibleForAnimation] = useState(isMapVisible);
  const mapUnmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isMapVisible) {
      setShouldRenderMap(true);
      if (mapUnmountTimeoutRef.current !== null) {
        clearTimeout(mapUnmountTimeoutRef.current);
        mapUnmountTimeoutRef.current = null;
      }
      setMapVisibleForAnimation(false);
      if (typeof window !== 'undefined') {
        let rafId: number | null = null;
        let rafId2: number | null = null;
        rafId = window.requestAnimationFrame(() => {
          rafId2 = window.requestAnimationFrame(() => {
            setMapVisibleForAnimation(true);
          });
        });
        return () => {
          if (rafId) window.cancelAnimationFrame(rafId);
          if (rafId2) window.cancelAnimationFrame(rafId2);
        };
      }
      setMapVisibleForAnimation(true);
      return undefined;
    }

    setMapVisibleForAnimation(false);
    return undefined;
  }, [isMapVisible]);

  useEffect(() => {
    if (mapVisibleForAnimation) {
      if (mapUnmountTimeoutRef.current !== null) {
        clearTimeout(mapUnmountTimeoutRef.current);
        mapUnmountTimeoutRef.current = null;
      }
      return undefined;
    }

    if (!shouldRenderMap) return undefined;

    const schedule: typeof setTimeout =
      typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout;
    const timeoutId = schedule(() => {
      setShouldRenderMap(false);
      mapUnmountTimeoutRef.current = null;
      setMapVisibleForAnimation(false);
    }, 400);
    mapUnmountTimeoutRef.current = timeoutId;

    return () => {
      clearTimeout(mapUnmountTimeoutRef.current ?? timeoutId);
      mapUnmountTimeoutRef.current = null;
    };
  }, [mapVisibleForAnimation, shouldRenderMap]);

  useEffect(() => {
    return () => {
      if (mapUnmountTimeoutRef.current !== null) {
        clearTimeout(mapUnmountTimeoutRef.current);
        mapUnmountTimeoutRef.current = null;
      }
    };
  }, []);

  const handleMapTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (mapVisibleForAnimation) return;
    setShouldRenderMap(false);
    if (mapUnmountTimeoutRef.current !== null) {
      clearTimeout(mapUnmountTimeoutRef.current);
      mapUnmountTimeoutRef.current = null;
    }
  }, [mapVisibleForAnimation]);

  const mapModal = useMemo(() => {
    if (!shouldRenderMap) return null;
    return (
      <MapDisplay
        adventureName={adventureName}
        currentMapNodeId={currentMapNodeId}
        destinationNodeId={destinationNodeId}
        initialLayoutConfig={initialLayoutConfig}
        initialViewBox={initialViewBox}
        isVisible={mapVisibleForAnimation}
        itemPresenceByNode={itemPresenceByNode}
        mapData={mapData}
        onClose={onCloseMap}
        onLayoutConfigChange={onLayoutConfigChange}
        onNodesPositioned={onNodesPositioned}
        onSelectDestination={onSelectDestination}
        onTransitionEnd={handleMapTransitionEnd}
        onViewBoxChange={onViewBoxChange}
      />
    );
  }, [
    adventureName,
    currentMapNodeId,
    destinationNodeId,
    initialLayoutConfig,
    initialViewBox,
    mapVisibleForAnimation,
    itemPresenceByNode,
    mapData,
    handleMapTransitionEnd,
    onCloseMap,
    onLayoutConfigChange,
    onNodesPositioned,
    onSelectDestination,
    onViewBoxChange,
    shouldRenderMap,
  ]);

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
        isVisible={isVisualizerVisible}
        localEnvironment={localEnvironment}
        localPlace={localPlace}
        localTime={localTime}
        mapData={mapData.nodes}
        onClose={onCloseVisualizer}
        setGeneratedImage={setGeneratedImage}
        theme={theme}
      />

      <KnowledgeBase
        allNPCs={allNPCs}
        isVisible={isKnowledgeBaseVisible}
        onClose={onCloseKnowledgeBase}
        theme={theme}
      />


      <PageView
        allNPCs={allNPCs}
        canInspectJournal={canInspectJournal}
        canWriteJournal={canWriteJournal}
        currentQuest={currentQuest}
        currentScene={currentScene}
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
        theme={theme}
        updateItemContent={updateContentHandler}
      />

      {mapModal}


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
