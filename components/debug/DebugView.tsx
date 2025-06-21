
/**
 * @file DebugView.tsx
 * @description Developer panel for inspecting game state.
 */
import { useState, useCallback } from 'react';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import { GameStateStack, DebugPacket, FullGameState } from '../../types';
import { TravelStep } from '../../utils/mapPathfinding';
import {
  CharactersTab,
  DialogueAITab,
  GameLogTab,
  GameStateTab,
  InventoryAITab,
  InventoryTab,
  MainAITab,
  MapDataFullTab,
  MapLocationAITab,
  MiscStateTab,
  ThemeHistoryTab,
  TravelPathTab,
} from './tabs';

interface DebugViewProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly debugPacket: DebugPacket | null;
  readonly gameStateStack: GameStateStack;
  readonly onUndoTurn: () => void; // New prop for undoing turn
  readonly onApplyGameState: (state: FullGameState) => void;
  readonly travelPath: Array<TravelStep> | null;
}

type DebugTab =
  | "GameState"
  | "MainAI"
  | "MapLocationAI"
  | "InventoryAI"
  | "DialogueAI"
  | "Inventory"
  | "Characters"
  | "MapDataFull"
  | "ThemeHistory"
  | "GameLog"
  | "TravelPath"
  | "MiscState";

/**
 * Developer-only panel for inspecting and manipulating game state.
 */
function DebugView({
  isVisible,
  onClose,
  debugPacket,
  gameStateStack,
  onUndoTurn,
  onApplyGameState,
  travelPath,
}: DebugViewProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>('GameState');

  const handleTabClick = useCallback(
    (name: DebugTab) => () => { setActiveTab(name); },
    []
  );

  if (!isVisible) return null;

  const currentState = gameStateStack[0];
  const previousState = gameStateStack[1];

  const tabs: Array<{ name: DebugTab; label: string }> = [
    { name: "GameState", label: "Game State" },
    { name: "MainAI", label: "Storyteller AI" },
    { name: "MapLocationAI", label: "Cartographer AI" },
    { name: "InventoryAI", label: "Inventory AI" },
    { name: "DialogueAI", label: "Dialogue AI" },
    { name: "Inventory", label: "Inventory" },
    { name: "Characters", label: "Characters" },
    { name: "MapDataFull", label: "Map Data" },
    { name: "ThemeHistory", label: "Theme History" },
    { name: "GameLog", label: "Game Log" },
    { name: "TravelPath", label: "Travel Path" },
    { name: "MiscState", label: "Misc State" },
  ];

  /**
   * Determines which debug tab content to display based on the active tab.
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'GameState':
        return (
          <GameStateTab
            currentState={currentState}
            onUndoTurn={onUndoTurn}
            onApplyGameState={onApplyGameState}
            previousState={previousState}
          />
        );
      case 'MainAI':
        return <MainAITab debugPacket={debugPacket} />;
      case 'MapLocationAI':
        return <MapLocationAITab debugPacket={debugPacket} />;
      case 'InventoryAI':
        return <InventoryAITab debugPacket={debugPacket} />;
      case 'DialogueAI':
        return <DialogueAITab debugPacket={debugPacket} />;
      case 'Inventory':
        return <InventoryTab inventory={currentState.inventory} />;
      case 'Characters':
        return <CharactersTab characters={currentState.allCharacters} />;
      case 'MapDataFull':
        return <MapDataFullTab mapData={currentState.mapData} />;
      case 'ThemeHistory':
        return <ThemeHistoryTab themeHistory={currentState.themeHistory} />;
      case 'GameLog':
        return <GameLogTab gameLog={currentState.gameLog} />;
      case 'TravelPath':
        return (
          <TravelPathTab
            mapData={currentState.mapData}
            travelPath={travelPath}
          />
        );
      case 'MiscState':
        return <MiscStateTab currentState={currentState} />;
      default:
        return (
          <p>
            Select a tab
          </p>
        );
    }
  };

  return (
    <div
      aria-labelledby="debug-view-title"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content flex flex-col">
        <Button
          ariaLabel="Close debug view"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <h1
          className="text-2xl font-bold text-amber-400 mb-3 text-center flex-shrink-0"
          id="debug-view-title"
        >
          Debug View & Game Internals
        </h1>
        
        <div className="flex flex-wrap border-b border-slate-700 mb-3 flex-shrink-0">
          {tabs.map(tab => (
            <Button
              ariaLabel={tab.label}
              key={tab.name}
              label={tab.label}
              onClick={handleTabClick(tab.name)}
              pressed={activeTab === tab.name}
              size="sm"
              variant="tab"
            />
          ))}
        </div>

        <div className="overflow-y-auto flex-grow p-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default DebugView;
