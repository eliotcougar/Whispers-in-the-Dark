
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
  NPCsTab,
  DialogueAITab,
  GameLogTab,
  GameStateTab,
  InventoryAITab,
  LibrarianAITab,
  InventoryTab,
  MainAITab,
  MapDataFullTab,
  LoreTab,
  MapLocationAITab,
  PlaygroundTab,
  LoremasterAITab,
  MiscStateTab,
  TravelPathTab,
  ToolsTab,
} from './tabs';

interface DebugViewProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly debugPacket: DebugPacket | null;
  readonly gameStateStack: GameStateStack;
  readonly onUndoTurn: () => void; // New prop for undoing turn
  readonly onApplyGameState: (state: FullGameState) => void;
  readonly onTriggerMainQuestAchieved: () => void;
  readonly onSimulateVictory: () => void;
  readonly onSpawnNpcAtLocation: () => void;
  readonly onSpawnBook: () => void;
  readonly onSpawnMap: () => void;
  readonly onSpawnPicture: () => void;
  readonly onSpawnPage: () => void;
  readonly onSpawnVehicle: () => void;
  readonly travelPath: Array<TravelStep> | null;
  readonly onDistillFacts: () => void;
  readonly debugLore: boolean;
  readonly onToggleDebugLore: () => void;
  readonly goodFacts: Array<string>;
  readonly badFacts: Array<string>;
  readonly onSaveFacts: (data: string) => void;
  readonly onClearFacts: () => void;
}

type DebugTab =
  | "GameState"
  | "MainAI"
  | "MapLocationAI"
  | "InventoryAI"
  | "LibrarianAI"
  | "DialogueAI"
  | "LoremasterAI"
  | "Inventory"
  | "NPCs"
  | "MapDataFull"
  | "Lore"
  | "GameLog"
  | "TravelPath"
  | "MiscState"
  | "Playground"
  | "Tools";

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
  onTriggerMainQuestAchieved,
  onSimulateVictory,
  onSpawnNpcAtLocation,
  onSpawnBook,
  onSpawnMap,
  onSpawnPicture,
  onSpawnPage,
  onSpawnVehicle,
  travelPath,
  onDistillFacts,
  debugLore,
  onToggleDebugLore,
  goodFacts,
  badFacts,
  onSaveFacts,
  onClearFacts,
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
    { name: "LibrarianAI", label: "Librarian AI" },
    { name: "LoremasterAI", label: "Loremaster AI" },
    { name: "DialogueAI", label: "Dialogue AI" },
    { name: "Inventory", label: "Inventory" },
    { name: "NPCs", label: "NPCs" },
    { name: "MapDataFull", label: "Map Data" },
    { name: "Lore", label: "Lore" },
    { name: "GameLog", label: "Game Log" },
    { name: "TravelPath", label: "Travel Path" },
    { name: "MiscState", label: "Misc State" },
    { name: "Playground", label: "Playground" },
    { name: "Tools", label: "Tools" },
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
            onApplyGameState={onApplyGameState}
            onUndoTurn={onUndoTurn}
            previousState={previousState}
          />
        );
      case 'MainAI':
        return <MainAITab debugPacket={debugPacket} />;
      case 'MapLocationAI':
        return <MapLocationAITab debugPacket={debugPacket} />;
      case 'InventoryAI':
        return <InventoryAITab debugPacket={debugPacket} />;
      case 'LibrarianAI':
        return <LibrarianAITab debugPacket={debugPacket} />;
      case 'LoremasterAI':
        return (
          <LoremasterAITab
            debugPacket={debugPacket}
            onDistillFacts={onDistillFacts}
          />
        );
      case 'DialogueAI':
        return <DialogueAITab debugPacket={debugPacket} />;
      case 'Inventory':
        return <InventoryTab inventory={currentState.inventory} />;
      case 'NPCs':
        return <NPCsTab npcs={currentState.allNPCs} />;
      case 'MapDataFull':
        return <MapDataFullTab mapData={currentState.mapData} />;
      case 'Lore':
        return (
          <LoreTab
            themeFacts={currentState.themeFacts}
          />
        );
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
      case 'Playground':
        return <PlaygroundTab />;
      case 'Tools':
        return (
          <ToolsTab
            badFacts={badFacts}
            debugLore={debugLore}
            goodFacts={goodFacts}
            onClearFacts={onClearFacts}
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
          />
        );
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
