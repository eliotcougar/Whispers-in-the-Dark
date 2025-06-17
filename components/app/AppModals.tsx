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
        currentSceneDescription={props.currentScene}
        currentTheme={props.currentTheme}
        mapData={props.mapData.nodes}
        allCharacters={props.allCharacters}
        localTime={props.localTime}
        localEnvironment={props.localEnvironment}
        localPlace={props.localPlace}
        isVisible={props.isVisualizerVisible}
        onClose={() => props.setIsVisualizerVisible(false)}
        setGeneratedImage={props.setGeneratedImage}
        cachedImageUrl={props.visualizerImageUrl}
        cachedImageScene={props.visualizerImageScene}
      />
      <KnowledgeBase
        allCharacters={props.allCharacters}
        currentTheme={props.currentTheme}
        isVisible={props.isKnowledgeBaseVisible}
        onClose={() => props.setIsKnowledgeBaseVisible(false)}
      />
      <HistoryDisplay
        themeHistory={props.themeHistory}
        gameLog={props.gameLog}
        isVisible={props.isHistoryVisible}
        onClose={() => props.setIsHistoryVisible(false)}
      />
      <MapDisplay
        mapData={props.mapData}
        currentThemeName={props.currentThemeName}
        currentMapNodeId={props.currentMapNodeId}
        destinationNodeId={props.destinationNodeId}
        itemPresenceByNode={props.itemPresenceByNode}
        onSelectDestination={props.onSelectDestination}
        initialLayoutConfig={props.initialLayoutConfig}
        initialViewBox={props.initialViewBox}
        onNodesPositioned={props.onNodesPositioned}
        onLayoutConfigChange={props.onLayoutConfigChange}
        onViewBoxChange={props.onViewBoxChange}
        isVisible={props.isMapVisible}
        onClose={props.onCloseMap}
      />
      <SettingsDisplay
        isVisible={props.isSettingsVisible}
        onClose={props.onCloseSettings}
        stabilityLevel={props.stabilityLevel}
        chaosLevel={props.chaosLevel}
        onStabilityChange={props.onStabilityChange}
        onChaosChange={props.onChaosChange}
        enabledThemePacks={props.enabledThemePacks}
        onToggleThemePack={props.onToggleThemePack}
        playerGender={props.playerGender}
        onPlayerGenderChange={props.onPlayerGenderChange}
        isCustomGameMode={props.isCustomGameMode}
      />
      <InfoDisplay isVisible={props.isInfoVisible} onClose={props.onCloseInfo} />
      <ConfirmationDialog
        isOpen={props.newGameFromMenuConfirmOpen}
        title="Confirm New Game"
        message="Are you sure you want to start a new game? Your current progress will be lost."
        onConfirm={props.confirmNewGameFromMenu}
        onCancel={props.cancelNewGameFromMenu}
        confirmText="Start New Game"
        confirmButtonClass="bg-red-600 hover:bg-red-500"
      />
      <ConfirmationDialog
        isOpen={props.newCustomGameConfirmOpen}
        title="Confirm Custom Game"
        message="Are you sure you want to start a new custom game? Your current progress will be lost."
        onConfirm={props.confirmNewCustomGame}
        onCancel={props.cancelNewCustomGame}
        confirmText="Start Custom Game"
        confirmButtonClass="bg-orange-600 hover:bg-orange-500"
      />
      <ConfirmationDialog
        isOpen={props.loadGameFromMenuConfirmOpen}
        title="Confirm Load Game"
        message="Are you sure you want to load a game? Your current progress will be overwritten if you load a new game."
        onConfirm={props.confirmLoadGameFromMenu}
        onCancel={props.cancelLoadGameFromMenu}
        confirmText="Load Game"
        confirmButtonClass="bg-blue-600 hover:bg-blue-500"
      />
      <ConfirmationDialog
        isOpen={props.shiftConfirmOpen}
        title="Confirm Reality Shift"
        message={<>This will destabilize the current reality, leading to an <strong className="text-purple-400">immediate and unpredictable shift</strong> to a new theme. Are you sure you wish to proceed?</>}
        onConfirm={props.confirmShift}
        onCancel={props.cancelShift}
        confirmText="Shift Reality"
        confirmButtonClass="bg-purple-600 hover:bg-purple-500"
        isCustomModeShift={props.isCustomGameModeShift}
      />
    </>
  );
};

export default AppModals;
