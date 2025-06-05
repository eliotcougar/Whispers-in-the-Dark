
/**
 * @file DebugView.tsx
 * @description Developer panel for inspecting game state.
 */
import React, { useState } from 'react';
import { GameStateStack, FullGameState, AIMapUpdatePayload, Item, Character, MapData, ThemeHistoryState, DebugPacket } from '../types';
import { structuredCloneGameState } from '../utils/cloneUtils';

interface DebugViewProps {
  isVisible: boolean;
  onClose: () => void;
  debugPacket: DebugPacket | null;
  gameStateStack: GameStateStack;
  onUndoTurn: () => void; // New prop for undoing turn
}

type DebugTab = "GameState" | "MainAI" | "MapLocationAI" | "Inventory" | "Characters" | "MapDataFull" | "ThemeHistory" | "GameLog" | "MiscState";

/**
 * Developer-only panel for inspecting and manipulating game state.
 */
const DebugView: React.FC<DebugViewProps> = ({ isVisible, onClose, debugPacket, gameStateStack, onUndoTurn }) => {
  const [activeTab, setActiveTab] = useState<DebugTab>("GameState");
  const [showMainAIRaw, setShowMainAIRaw] = useState<boolean>(true);
  const [showMapAIRaw, setShowMapAIRaw] = useState<boolean>(true);

  if (!isVisible) return null;

  const currentState = gameStateStack[0];
  const previousState = gameStateStack[1];

  const renderContent = (title: string, content: any, isJson: boolean = true, maxHeightClass: string = "max-h-60") => {
    let displayContent: string;
    if (content === null || content === undefined) {
      displayContent = "N/A";
    } else if (typeof content === 'string') {
      displayContent = content;
    } else if (isJson) {
      try {
        let contentForDisplay: any = structuredCloneGameState(content);
        
        if (title.startsWith("Current Game State") || title.startsWith("Previous Game State")) {
            if ('lastDebugPacket' in contentForDisplay) delete contentForDisplay.lastDebugPacket;
            if ('lastTurnChanges' in contentForDisplay) delete contentForDisplay.lastTurnChanges;
            if ('mapData' in contentForDisplay && contentForDisplay.mapData && Array.isArray(contentForDisplay.mapData.nodes)) {
                contentForDisplay.mapDataSummary = {
                    nodeCount: contentForDisplay.mapData.nodes.length,
                    edgeCount: contentForDisplay.mapData.edges.length,
                    firstNNodeNames: contentForDisplay.mapData.nodes.slice(0,5).map((n: any) => n.placeName)
                };
                delete contentForDisplay.mapData;
            }
        }
        displayContent = JSON.stringify(contentForDisplay, null, 2);
      } catch (e) {
        displayContent = "Error stringifying JSON content.";
        console.error("Error stringifying debug content:", e, content);
      }
    } else {
      displayContent = String(content);
    }

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
    { name: "MainAI", label: "Main AI" },
    { name: "MapLocationAI", label: "Map & Location AI" },
    { name: "Inventory", label: "Inventory" },
    { name: "Characters", label: "Characters" },
    { name: "MapDataFull", label: "Map Data (Full)" },
    { name: "ThemeHistory", label: "Theme History" },
    { name: "GameLog", label: "Game Log" },
    { name: "MiscState", label: "Misc State" },
  ];

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
            {renderContent("Last Main AI Request Prompt", debugPacket?.prompt, false)}
            <div className="my-2">
              <button
                onClick={() => setShowMainAIRaw(!showMainAIRaw)}
                className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
              >
                Toggle Raw/Parsed Response
              </button>
            </div>
            {showMainAIRaw ?
              renderContent("Main AI Raw Response Text", debugPacket?.rawResponseText, false) :
              renderContent("Parsed Main AI Response", debugPacket?.parsedResponse)
            }
            {debugPacket?.error && renderContent("Error During Main AI Interaction", debugPacket.error, false)}
          </>
        );
      case "MapLocationAI":
        return (
          <>
            <p className="text-sm text-slate-400 mb-2">Map Update related to interaction at: {timestamp}</p>
            {debugPacket?.mapUpdateDebugInfo ? (
              <>
                {renderContent("Map Update AI Request Prompt", debugPacket.mapUpdateDebugInfo.prompt, false)}
                <div className="my-2">
                  <button
                    onClick={() => setShowMapAIRaw(!showMapAIRaw)}
                    className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                  >
                    Toggle Raw/Parsed Map Update Response
                  </button>
                </div>
                {showMapAIRaw ?
                  renderContent("Map Update AI Raw Response Text", debugPacket.mapUpdateDebugInfo.rawResponse, false) :
                  renderContent("Parsed Map Update AI Payload", debugPacket.mapUpdateDebugInfo.parsedPayload)
                }
                {debugPacket.mapUpdateDebugInfo.validationError && renderContent("Map Update Validation Error", debugPacket.mapUpdateDebugInfo.validationError, false)}
              </>
            ) : (
              <p className="italic text-slate-400">No Map Update AI interaction debug packet captured for the last main AI turn.</p>
            )}
             {debugPacket?.mapPruningDebugInfo && (
                <>
                  <h3 className="text-lg font-semibold text-sky-400 mt-3 mb-1">Map Pruning/Refinement Details</h3>
                  {renderContent("Map Pruning - Chains to Refine Count", debugPacket.mapPruningDebugInfo.pruningDebugInfo?.chainsToRefineCount, false)}
                  {debugPacket.mapPruningDebugInfo.refinementDebugInfo?.prompt && renderContent("Map Pruning - Refinement AI Prompt", debugPacket.mapPruningDebugInfo.refinementDebugInfo.prompt, false)}
                  {debugPacket.mapPruningDebugInfo.refinementDebugInfo?.rawResponse && renderContent("Map Pruning - Refinement AI Raw Response", debugPacket.mapPruningDebugInfo.refinementDebugInfo.rawResponse, false)}
                  {debugPacket.mapPruningDebugInfo.refinementDebugInfo?.parsedPayload && renderContent("Map Pruning - Refinement Parsed Payload", debugPacket.mapPruningDebugInfo.refinementDebugInfo.parsedPayload)}
                  {debugPacket.mapPruningDebugInfo.refinementDebugInfo?.validationError && renderContent("Map Pruning - Refinement Validation Error", debugPacket.mapPruningDebugInfo.refinementDebugInfo.validationError, false)}
                </>
              )}
          </>
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
