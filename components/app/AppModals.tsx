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
  isVisualizerVisible: boolean;
  setIsVisualizerVisible: React.Dispatch<React.SetStateAction<boolean>>;
  visualizerImageUrl: string | null;
  visualizerImageScene: string | null;
  setGeneratedImage: (url: string, scene: string) => void;
  currentScene: string;
  currentTheme: AdventureTheme;
  mapData: MapData;
  allCharacters: Character[];
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;

  isKnowledgeBaseVisible: boolean;
  setIsKnowledgeBaseVisible: React.Dispatch<React.SetStateAction<boolean>>;

  isHistoryVisible: boolean;
  setIsHistoryVisible: React.Dispatch<React.SetStateAction<boolean>>;
  themeHistory: ThemeHistoryState;
  gameLog: string[];

  isSettingsVisible: boolean;
  onCloseSettings: () => void;
  stabilityLevel: number;
  chaosLevel: number;
  onStabilityChange: (v: number) => void;
  onChaosChange: (v: number) => void;
  enabledThemePacks: ThemePackName[];
  onToggleThemePack: (p: ThemePackName) => void;
  playerGender: string;
  onPlayerGenderChange: (g: string) => void;
  isCustomGameMode: boolean;

  isInfoVisible: boolean;
  onCloseInfo: () => void;

  isMapVisible: boolean;
  onCloseMap: () => void;
  currentThemeName: string | null;
  currentMapNodeId: string | null;
  destinationNodeId: string | null;
  itemPresenceByNode: Record<string, { hasUseful: boolean; hasVehicle: boolean }>;
  onSelectDestination: (id: string | null) => void;
  initialLayoutConfig: MapLayoutConfig;
  initialViewBox: string;
  onViewBoxChange: (viewBox: string) => void;
  onNodesPositioned: (nodes: MapNode[]) => void;
  onLayoutConfigChange: (cfg: MapLayoutConfig) => void;

  newGameFromMenuConfirmOpen: boolean;
  confirmNewGameFromMenu: () => void;
  cancelNewGameFromMenu: () => void;
  newCustomGameConfirmOpen: boolean;
  confirmNewCustomGame: () => void;
  cancelNewCustomGame: () => void;
  loadGameFromMenuConfirmOpen: boolean;
  confirmLoadGameFromMenu: () => void;
  cancelLoadGameFromMenu: () => void;
  shiftConfirmOpen: boolean;
  confirmShift: () => void;
  cancelShift: () => void;
  isCustomGameModeShift: boolean;
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
