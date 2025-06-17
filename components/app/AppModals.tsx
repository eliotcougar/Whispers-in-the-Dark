import React from 'react';
import KnowledgeBase from '../KnowledgeBase';
import SettingsDisplay from '../SettingsDisplay';
import InfoDisplay from '../InfoDisplay';
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
  ThemePackName,
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

  readonly isSettingsVisible: boolean;
  readonly onCloseSettings: () => void;
  readonly stabilityLevel: number;
  readonly chaosLevel: number;
  readonly onStabilityChange: (v: number) => void;
  readonly onChaosChange: (v: number) => void;
  readonly enabledThemePacks: ThemePackName[];
  readonly onToggleThemePack: (p: ThemePackName) => void;
  readonly playerGender: string;
  readonly onPlayerGenderChange: (g: string) => void;
  readonly isCustomGameMode: boolean;

  readonly isInfoVisible: boolean;
  readonly onCloseInfo: () => void;

  readonly isMapVisible: boolean;
  readonly onCloseMap: () => void;
  readonly currentThemeName: string | null;
  readonly currentMapNodeId: string | null;
  readonly destinationNodeId: string | null;
  readonly itemPresenceByNode: Record<string, { hasUseful: boolean; hasVehicle: boolean }>;
  readonly onSelectDestination: (id: string | null) => void;
  readonly initialLayoutConfig: MapLayoutConfig;
  readonly initialViewBox: string;
  readonly onViewBoxChange: (viewBox: string) => void;
  readonly onNodesPositioned: (nodes: MapNode[]) => void;
  readonly onLayoutConfigChange: (cfg: MapLayoutConfig) => void;

  readonly newGameFromMenuConfirmOpen: boolean;
  readonly confirmNewGameFromMenu: () => void;
  readonly cancelNewGameFromMenu: () => void;
  readonly newCustomGameConfirmOpen: boolean;
  readonly confirmNewCustomGame: () => void;
  readonly cancelNewCustomGame: () => void;
  readonly loadGameFromMenuConfirmOpen: boolean;
  readonly confirmLoadGameFromMenu: () => void;
  readonly cancelLoadGameFromMenu: () => void;
  readonly shiftConfirmOpen: boolean;
  readonly confirmShift: () => void;
  readonly cancelShift: () => void;
  readonly isCustomGameModeShift: boolean;
}

const AppModals: React.FC<AppModalsProps> = (props) => {
  if (!props.currentTheme) return null;
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
        onClose={() => props.setIsVisualizerVisible(false)}
        setGeneratedImage={props.setGeneratedImage}
      />

      <KnowledgeBase
        allCharacters={props.allCharacters}
        currentTheme={props.currentTheme}
        isVisible={props.isKnowledgeBaseVisible}
        onClose={() => props.setIsKnowledgeBaseVisible(false)}
      />

      <HistoryDisplay
        gameLog={props.gameLog}
        isVisible={props.isHistoryVisible}
        onClose={() => props.setIsHistoryVisible(false)}
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

      <SettingsDisplay
        chaosLevel={props.chaosLevel}
        enabledThemePacks={props.enabledThemePacks}
        isCustomGameMode={props.isCustomGameMode}
        isVisible={props.isSettingsVisible}
        onChaosChange={props.onChaosChange}
        onClose={props.onCloseSettings}
        onPlayerGenderChange={props.onPlayerGenderChange}
        onStabilityChange={props.onStabilityChange}
        onToggleThemePack={props.onToggleThemePack}
        playerGender={props.playerGender}
        stabilityLevel={props.stabilityLevel}
      />

      <InfoDisplay isVisible={props.isInfoVisible} onClose={props.onCloseInfo} />

      <ConfirmationDialog
        confirmButtonClass="bg-red-600 hover:bg-red-500"
        confirmText="Start New Game"
        isOpen={props.newGameFromMenuConfirmOpen}
        message="Are you sure you want to start a new game? Your current progress will be lost."
        onCancel={props.cancelNewGameFromMenu}
        onConfirm={props.confirmNewGameFromMenu}
        title="Confirm New Game"
      />

      <ConfirmationDialog
        confirmButtonClass="bg-orange-600 hover:bg-orange-500"
        confirmText="Start Custom Game"
        isOpen={props.newCustomGameConfirmOpen}
        message="Are you sure you want to start a new custom game? Your current progress will be lost."
        onCancel={props.cancelNewCustomGame}
        onConfirm={props.confirmNewCustomGame}
        title="Confirm Custom Game"
      />

      <ConfirmationDialog
        confirmButtonClass="bg-blue-600 hover:bg-blue-500"
        confirmText="Load Game"
        isOpen={props.loadGameFromMenuConfirmOpen}
        message="Are you sure you want to load a game? Your current progress will be overwritten if you load a new game."
        onCancel={props.cancelLoadGameFromMenu}
        onConfirm={props.confirmLoadGameFromMenu}
        title="Confirm Load Game"
      />

      <ConfirmationDialog
        confirmButtonClass="bg-purple-600 hover:bg-purple-500"
        confirmText="Shift Reality"
        isCustomModeShift={props.isCustomGameModeShift}
        isOpen={props.shiftConfirmOpen}
        message={<>This will destabilize the current reality, leading to an <strong className="text-purple-400">immediate and unpredictable shift</strong> to a new theme. Are you sure you wish to proceed?</>}
        onCancel={props.cancelShift}
        onConfirm={props.confirmShift}
        title="Confirm Reality Shift"
      />
    </>
  );
};

export default AppModals;
