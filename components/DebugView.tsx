
/**
 * @file DebugView.tsx
 * @description Developer panel for inspecting game state.
 */
import React, { useState } from 'react';
import { GameStateStack, DebugPacket, MapNode } from '../types';
import { TravelStep } from '../utils/mapPathfinding';
import { structuredCloneGameState } from '../utils/cloneUtils';

interface DebugViewProps {
  isVisible: boolean;
  onClose: () => void;
  debugPacket: DebugPacket | null;
  gameStateStack: GameStateStack;
  onUndoTurn: () => void; // New prop for undoing turn
  travelPath: TravelStep[] | null;
}

type DebugTab =
  | "GameState"
  | "MainAI"
  | "MapLocationAI"
  | "InventoryAI"
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
const DebugView: React.FC<DebugViewProps> = ({
  isVisible,
  onClose,
  debugPacket,
  gameStateStack,
  onUndoTurn,
  travelPath,
}) => {
  const [activeTab, setActiveTab] = useState<DebugTab>("GameState");
  const [showMainAIRaw, setShowMainAIRaw] = useState<boolean>(true);
  const [showMapAIRaw, setShowMapAIRaw] = useState<boolean>(true);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  if (!isVisible) return null;

  const currentState = gameStateStack[0];
  const previousState = gameStateStack[1];

  /**
   * Renders a single debugging section with a JSON or text payload.
   */
  const renderContent = <T,>(
    title: string,
    content: T,
    isJson: boolean = true,
    maxHeightClass: string = "max-h-60",
  ) => {
    const displayContent: string = (() => {
      if (content === null || content === undefined) {
        return "N/A";
      }
      if (typeof content === 'string') {
        return content;
      }
      if (isJson) {
        try {
          const contentForDisplay = structuredCloneGameState(content);

          if (title.startsWith("Current Game State") || title.startsWith("Previous Game State")) {
            if (isRecord(contentForDisplay)) {
              if ('lastDebugPacket' in contentForDisplay) delete contentForDisplay.lastDebugPacket;
              if ('lastTurnChanges' in contentForDisplay) delete contentForDisplay.lastTurnChanges;

              if ('mapData' in contentForDisplay) {
                const mapData = contentForDisplay.mapData as { nodes: MapNode[]; edges: unknown[] } | undefined;

                if (mapData && Array.isArray(mapData.nodes) && Array.isArray(mapData.edges)) {
                  (contentForDisplay as Record<string, unknown>).mapDataSummary = {
                    nodeCount: mapData.nodes.length,
                    edgeCount: mapData.edges.length,
                    firstNNodeNames: mapData.nodes.slice(0, 5).map((n: MapNode) => n.placeName),
                  };
                  delete (contentForDisplay as Record<string, unknown>).mapData;
                }
              }
            }
          }

          return JSON.stringify(contentForDisplay, null, 2);
        } catch (e) {
          console.error("Error stringifying debug content:", e, content);
          return "Error stringifying JSON content.";
        }
      }
      return String(content);
    })();

    return (
      <section className="mb-4">
        <h3 className="text-lg font-semibold text-sky-400 mb-1">{title}</h3>
        <pre className={`bg-slate-900 p-2 rounded-md text-xs text-slate-200 overflow-auto ${maxHeightClass} whitespace-pre-wrap break-all`}>
          <code>{displayContent}</code>
        </pre>
      </section>
    );
  };
  
  const timestamp = debugPacket?.timestamp ? new Date(debugPacket.timestamp).toLocaleString() : "N/A";

  const tabs: { name: DebugTab; label: string }[] = [
    { name: "GameState", label: "Game State" },
    { name: "MainAI", label: "Storyteller AI" },
    { name: "MapLocationAI", label: "Cartographer AI" },
    { name: "InventoryAI", label: "Inventory AI" },
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
      case "GameState":
        return (
          <>
            <button
              onClick={onUndoTurn}
              disabled={!previousState || currentState.globalTurnNumber <= 1}
              className="mb-3 px-3 py-1.5 text-sm font-medium rounded shadow transition-colors duration-150 bg-orange-600 text-white hover:bg-orange-500 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
              aria-label="Undo last turn"
            >
              Undo Turn (Global Turn: {currentState.globalTurnNumber})
            </button>
            {currentState && renderContent("Current Game State (Stack[0] - Top)", currentState, true, "max-h-[30vh]")}
            {previousState && renderContent("Previous Game State (Stack[1] - Bottom)", previousState, true, "max-h-[30vh]")}
          </>
        );
      case "MainAI":
        return (
          <>
            <p className="text-sm text-slate-400 mb-2">Timestamp: {timestamp}</p>
            {renderContent("Last Storyteller AI Request", debugPacket?.prompt, false)}
            <div className="my-2">
              <button
                onClick={() => setShowMainAIRaw(!showMainAIRaw)}
                className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
              >
                Toggle Raw/Parsed Response
              </button>
            </div>
            {showMainAIRaw ?
              renderContent("Storyteller AI Response Raw", debugPacket?.rawResponseText, false) :
              renderContent("Storyteller AI Response Parsed ", debugPacket?.parsedResponse)
            }
            {debugPacket?.error && renderContent("Error During Storyteller AI Interaction", debugPacket.error, false)}
          </>
        );
      case "MapLocationAI":
        return (
          <>
            <p className="text-sm text-slate-400 mb-2">Map Update related to interaction at: {timestamp}</p>
            {debugPacket?.mapUpdateDebugInfo ? (
              <>
                {renderContent("Cartographer AI Request", debugPacket.mapUpdateDebugInfo.prompt, false)}
                <div className="my-2">
                  <button
                    onClick={() => setShowMapAIRaw(!showMapAIRaw)}
                    className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                  >
                    Toggle Raw/Parsed Map Update Response
                  </button>
                </div>
                {showMapAIRaw ?
                  renderContent("Cartographer AI Response Raw", debugPacket.mapUpdateDebugInfo.rawResponse, false) :
                  renderContent("Cartographer AI Response Parsed", debugPacket.mapUpdateDebugInfo.parsedPayload)
                }
                {debugPacket.mapUpdateDebugInfo.validationError && renderContent("Map Update Validation Error", debugPacket.mapUpdateDebugInfo.validationError, false)}
                {debugPacket.mapUpdateDebugInfo.minimalModelCalls &&
                  renderContent("Minimal Model Calls", debugPacket.mapUpdateDebugInfo.minimalModelCalls)}
                {debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo && (
                  <>
                    {renderContent(
                      "Connector Chains Prompt",
                      debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.prompt,
                      false
                    )}
                    {debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.rawResponse &&
                      renderContent(
                        "Connector Chains Raw Response",
                        debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.rawResponse,
                        false
                      )}
                    {debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.parsedPayload &&
                      renderContent(
                        "Connector Chains Parsed Payload",
                        debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.parsedPayload
                      )}
                    {debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.validationError &&
                      renderContent(
                        "Connector Chains Validation Error",
                        debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.validationError,
                        false
                      )}
                  </>
                )}
              </>
            ) : (
              <p className="italic text-slate-400">No Map Update AI interaction debug packet captured for the last main AI turn.</p>
            )}
          </>
        );
      case "InventoryAI":
        return debugPacket?.inventoryDebugInfo ? (
          <>
            {renderContent(
              "Inventory AI Request",
              debugPacket.inventoryDebugInfo.prompt,
              false,
            )}
            {renderContent(
              "Inventory AI Response Raw",
              debugPacket.inventoryDebugInfo.rawResponse,
              false,
            )}
          </>
        ) : (
          <p className="italic text-slate-400">No Inventory AI interaction debug packet captured.</p>
        );
      case "Inventory":
        return renderContent("Current Inventory", currentState?.inventory, true, "max-h-[70vh]");
      case "Characters":
        return renderContent("Current Characters", currentState?.allCharacters, true, "max-h-[70vh]");
      case "MapDataFull":
        return renderContent("Current Map Data (Full)", currentState?.mapData, true, "max-h-[70vh]");
      case "ThemeHistory":
        return renderContent("Current Theme History", currentState?.themeHistory, true, "max-h-[70vh]");
      case "GameLog":
        return renderContent("Current Game Log", currentState?.gameLog, true, "max-h-[70vh]");
      case "TravelPath": {
        if (!travelPath || travelPath.length === 0) {
          return <p className="italic text-slate-400">No destination set.</p>;
        }
        const mapData = currentState?.mapData;
        const expanded = travelPath.map(step => {
          if (step.step === 'node') {
            const node = mapData?.nodes.find(n => n.id === step.id);
            return { step: 'node', data: node || { id: step.id, missing: true } };
          }
          if (step.id.startsWith('hierarchy:')) {
            const [from, to] = step.id.split(':')[1].split('->');
            return { step: 'hierarchy', from, to };
          }
          const edge = mapData?.edges.find(e => e.id === step.id);
          return { step: 'edge', data: edge || { id: step.id, missing: true } };
        });
        return (
          <>
            {renderContent('Travel Path (IDs)', travelPath)}
            {renderContent('Expanded Path Data', expanded, true, 'max-h-[70vh]')}
          </>
        );
      }
      case "MiscState":
        return renderContent("Miscellaneous State Values", {
            currentThemeName: currentState?.currentThemeName,
            mainQuest: currentState?.mainQuest,
            currentObjective: currentState?.currentObjective,
            score: currentState?.score,
            localTime: currentState?.localTime,
            localEnvironment: currentState?.localEnvironment,
            localPlace: currentState?.localPlace,
            currentMapNodeId: currentState?.currentMapNodeId,
            turnsSinceLastShift: currentState?.turnsSinceLastShift,
            globalTurnNumber: currentState?.globalTurnNumber,
            isCustomGameMode: currentState?.isCustomGameMode,
            pendingNewThemeNameAfterShift: currentState?.pendingNewThemeNameAfterShift,
            isAwaitingManualShiftThemeSelection: currentState?.isAwaitingManualShiftThemeSelection,
            objectiveAnimationType: currentState?.objectiveAnimationType,
            lastTurnChangesBrief: currentState?.lastTurnChanges ? {
                items: currentState.lastTurnChanges.itemChanges.length,
                chars: currentState.lastTurnChanges.characterChanges.length,
                objAchieved: currentState.lastTurnChanges.objectiveAchieved,
                mapChanged: currentState.lastTurnChanges.mapDataChanged,
            } : null,
        }, true, "max-h-[70vh]");
      default:
        return <p>Select a tab</p>;
    }
  };

  return (
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="debug-view-title">
      <div className="animated-frame-content flex flex-col">
        <button
          onClick={onClose}
          className="animated-frame-close-button"
          aria-label="Close debug view"
        >
          &times;
        </button>
        <h1 id="debug-view-title" className="text-2xl font-bold text-amber-400 mb-3 text-center flex-shrink-0">
          Debug View & Game Internals
        </h1>
        
        <div className="flex flex-wrap border-b border-slate-700 mb-3 flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`px-3 py-2 text-sm font-medium transition-colors
                          ${activeTab === tab.name 
                            ? 'border-b-2 border-sky-400 text-sky-300' 
                            : 'text-slate-400 hover:text-sky-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-grow p-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default DebugView;
