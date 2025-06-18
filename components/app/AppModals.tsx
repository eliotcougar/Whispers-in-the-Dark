import * as React from 'react';
import KnowledgeBase from '../KnowledgeBase';
import MapDisplay from '../MapDisplay';
import ConfirmationDialog from '../ConfirmationDialog';
import HistoryDisplay from '../HistoryDisplay';
import ImageVisualizer from '../ImageVisualizer';
import {
  AdventureTheme,
  MapData,
  MapLayoutConfig,
  Character,
  ThemeHistoryState,
  MapNode,
} from '../../types';

interface AppModalsProps {
  // Visibility flags
  readonly isVisualizerVisible: boolean;
  readonly setIsVisualizerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly visualizerImageUrl: string | null;
  readonly visualizerImageScene: string | null;
  readonly setGeneratedImage: (url: string, scene: string) => void;
  readonly currentScene: string;
  readonly currentTheme: AdventureTheme;
  readonly mapData: MapData;
  readonly allCharacters: Character[];
  readonly localTime: string | null;
  readonly localEnvironment: string | null;
  readonly localPlace: string | null;

  readonly isKnowledgeBaseVisible: boolean;
  readonly setIsKnowledgeBaseVisible: React.Dispatch<React.SetStateAction<boolean>>;

  readonly isHistoryVisible: boolean;
  readonly setIsHistoryVisible: React.Dispatch<React.SetStateAction<boolean>>;
  readonly themeHistory: ThemeHistoryState;
  readonly gameLog: string[];

  readonly onCloseInfo: () => void;

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
  readonly onNodesPositioned: (nodes: MapNode[]) => void;
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
}

function AppModals(props: AppModalsProps) {
  const {
    setIsVisualizerVisible,
    setIsKnowledgeBaseVisible,
    setIsHistoryVisible,
  } = props;

  const handleCloseVisualizer = React.useCallback(() => {
    setIsVisualizerVisible(false);
  }, [setIsVisualizerVisible]);

  const handleCloseKnowledgeBase = React.useCallback(() => {
    setIsKnowledgeBaseVisible(false);
  }, [setIsKnowledgeBaseVisible]);

  const handleCloseHistory = React.useCallback(() => {
    setIsHistoryVisible(false);
  }, [setIsHistoryVisible]);

  return (
    <>
      <ImageVisualizer
        allCharacters={props.allCharacters}
        cachedImageScene={props.visualizerImageScene}
        cachedImageUrl={props.visualizerImageUrl}
        currentSceneDescription={props.currentScene}
        currentTheme={props.currentTheme}
        isVisible={props.isVisualizerVisible}
        localEnvironment={props.localEnvironment}
        localPlace={props.localPlace}
        localTime={props.localTime}
        mapData={props.mapData.nodes}
        onClose={handleCloseVisualizer}
        setGeneratedImage={props.setGeneratedImage}
      />

      <KnowledgeBase
        allCharacters={props.allCharacters}
        currentTheme={props.currentTheme}
        isVisible={props.isKnowledgeBaseVisible}
        onClose={handleCloseKnowledgeBase}
      />

      <HistoryDisplay
        gameLog={props.gameLog}
        isVisible={props.isHistoryVisible}
        onClose={handleCloseHistory}
        themeHistory={props.themeHistory}
      />

      <MapDisplay
        currentMapNodeId={props.currentMapNodeId}
        currentThemeName={props.currentThemeName}
        destinationNodeId={props.destinationNodeId}
        initialLayoutConfig={props.initialLayoutConfig}
        initialViewBox={props.initialViewBox}
        isVisible={props.isMapVisible}
        itemPresenceByNode={props.itemPresenceByNode}
        mapData={props.mapData}
        onClose={props.onCloseMap}
        onLayoutConfigChange={props.onLayoutConfigChange}
        onNodesPositioned={props.onNodesPositioned}
        onSelectDestination={props.onSelectDestination}
        onViewBoxChange={props.onViewBoxChange}
      />


      <ConfirmationDialog
        confirmButtonClass="bg-red-600 hover:bg-red-500"
        confirmText="Start New Game"
        isOpen={props.newGameFromMenuConfirmOpen}
        message="Are you sure you want to start a new game? Your current progress will be lost."
        onCancel={props.handleCancelNewGameFromMenu}
        onConfirm={props.handleConfirmNewGameFromMenu}
        title="Confirm New Game"
      />

      <ConfirmationDialog
        confirmButtonClass="bg-orange-600 hover:bg-orange-500"
        confirmText="Start Custom Game"
        isOpen={props.newCustomGameConfirmOpen}
        message="Are you sure you want to start a new custom game? Your current progress will be lost."
        onCancel={props.handleCancelNewCustomGame}
        onConfirm={props.handleConfirmNewCustomGame}
        title="Confirm Custom Game"
      />

      <ConfirmationDialog
        confirmButtonClass="bg-blue-600 hover:bg-blue-500"
        confirmText="Load Game"
        isOpen={props.loadGameFromMenuConfirmOpen}
        message="Are you sure you want to load a game? Your current progress will be overwritten if you load a new game."
        onCancel={props.handleCancelLoadGameFromMenu}
        onConfirm={props.handleConfirmLoadGameFromMenu}
        title="Confirm Load Game"
      />

      <ConfirmationDialog
        confirmButtonClass="bg-purple-600 hover:bg-purple-500"
        confirmText="Shift Reality"
        isCustomModeShift={props.isCustomGameModeShift}
        isOpen={props.shiftConfirmOpen}
        message={<>
          This will destabilize the current reality, leading to an
          <strong className="text-purple-400">
            immediate and unpredictable shift
          </strong>

          {' '}
          to a new theme. Are you sure you wish to proceed?
        </>}
        onCancel={props.handleCancelShift}
        onConfirm={props.handleConfirmShift}
        title="Confirm Reality Shift"
      />
    </>
  );
}

export default AppModals;
