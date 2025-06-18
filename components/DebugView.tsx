
/**
 * @file DebugView.tsx
 * @description Developer panel for inspecting game state.
 */
import { useState, useCallback } from 'react';

import { extractJsonFromFence } from '../utils/jsonUtils';
import { GameStateStack, DebugPacket, MapNode } from '../types';
import { TravelStep } from '../utils/mapPathfinding';
import { structuredCloneGameState } from '../utils/cloneUtils';

interface DebugViewProps {
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly debugPacket: DebugPacket | null;
  readonly gameStateStack: GameStateStack;
  readonly onUndoTurn: () => void; // New prop for undoing turn
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
  travelPath,
}: DebugViewProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>("GameState");
  const [showMainAIRaw, setShowMainAIRaw] = useState<boolean>(true);
  const [showMapAIRaw, setShowMapAIRaw] = useState<boolean>(true);
  const [showInventoryAIRaw, setShowInventoryAIRaw] = useState<boolean>(true);
  const [showConnectorChainRaw, setShowConnectorChainRaw] = useState<Record<number, boolean>>({});

  const toggleShowMainAIRaw = useCallback(
    () => { setShowMainAIRaw(prev => !prev); },
    []
  );

  const toggleShowMapAIRaw = useCallback(
    () => { setShowMapAIRaw(prev => !prev); },
    []
  );

  const toggleShowInventoryAIRaw = useCallback(
    () => { setShowInventoryAIRaw(prev => !prev); },
    []
  );

  const toggleShowConnectorChainRaw = useCallback(
    (idx: number) => () =>
      { setShowConnectorChainRaw(prev => ({ ...prev, [idx]: !prev[idx] })); },
    []
  );

  const handleTabClick = useCallback(
    (name: DebugTab) => () => { setActiveTab(name); },
    []
  );

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  if (!isVisible) return null;

  const currentState = gameStateStack[0];
  const previousState = gameStateStack[1];

  /**
   * Renders a single debugging section with a JSON or text payload.
   */
  const decodeEscapedString = (text: string): string => {
    try {
      return JSON.parse(`"${text.replace(/"/g, '\\"')}"`) as string;
    } catch {
      return text.replace(/\\n/g, '\n');
    }
  };

  const filterObservationsAndRationale = (raw: string | undefined | null): string => {
    if (!raw) return "";
    const jsonStr = extractJsonFromFence(raw);
    try {
      const parsed: unknown = JSON.parse(jsonStr);
      const strip = (obj: unknown) => {
        if (obj && typeof obj === 'object') {
          delete (obj as Record<string, unknown>).observations;
          delete (obj as Record<string, unknown>).rationale;
          Object.values(obj).forEach(strip);
        }
      };
      strip(parsed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw.replace(/"?(observations|rationale)"?\s*:\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*,?/gi, '').trim();
    }
  };

  const renderContent = (
    title: string,
    content: unknown,
    isJson = true,
    maxHeightClass = "max-h-60",
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
                const mapData = contentForDisplay.mapData as { nodes: Array<MapNode>; edges: Array<unknown> } | undefined;

                if (mapData && Array.isArray(mapData.nodes) && Array.isArray(mapData.edges)) {
                  contentForDisplay.mapDataSummary = {
                    nodeCount: mapData.nodes.length,
                    edgeCount: mapData.edges.length,
                    firstNNodeNames: mapData.nodes.slice(0, 5).map((n: MapNode) => n.placeName),
                  };
                  delete contentForDisplay.mapData;
                }
              }
            }
          }

          if (title.toLowerCase().includes('parsed')) {
            const strip = (obj: unknown) => {
              if (obj && typeof obj === 'object') {
                delete (obj as Record<string, unknown>).observations;
                delete (obj as Record<string, unknown>).rationale;
                Object.values(obj).forEach(strip);
              }
            };
            strip(contentForDisplay);
          }

          return JSON.stringify(contentForDisplay, null, 2);
        } catch (e) {
          console.error("Error stringifying debug content:", e, content);
          return "Error stringifying JSON content.";
        }
      }
      return typeof content === 'string'
        ? content
        : JSON.stringify(content, null, 2);
    })();

    return (
      <section className="mb-4">
        <h3 className="text-lg font-semibold text-sky-400 mb-1">
          {title}
        </h3>

        <pre className={`bg-slate-900 p-2 rounded-md text-xs text-slate-200 overflow-auto ${maxHeightClass} whitespace-pre-wrap break-all`}>
          <code>
            {displayContent}
          </code>
        </pre>
      </section>
    );
  };
  
  const timestamp = debugPacket?.timestamp ? new Date(debugPacket.timestamp).toLocaleString() : "N/A";

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
      case "GameState":
        return (
          <>
            <button
              aria-label="Undo last turn"
              className="mb-3 px-3 py-1.5 text-sm font-medium rounded shadow transition-colors duration-150 bg-orange-600 text-white hover:bg-orange-500 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
              disabled={!previousState || currentState.globalTurnNumber <= 1}
              onClick={onUndoTurn}
              type="button"
            >
              Undo Turn (Global Turn: 
              {' '}

              {currentState.globalTurnNumber}
              )
            </button>

            {renderContent("Current Game State (Stack[0] - Top)", currentState, true, "max-h-[30vh]")}

            {previousState ? renderContent("Previous Game State (Stack[1] - Bottom)", previousState, true, "max-h-[30vh]") : null}
          </>
        );
      case "MainAI":
        return (
          <>
            <p className="text-sm text-slate-400 mb-2">
              Timestamp:
              {timestamp}
            </p>

            {renderContent("Last Storyteller AI Request", debugPacket?.prompt, false)}

            <div className="my-2">
              <button
                className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                onClick={toggleShowMainAIRaw}
                type="button"
              >
                Toggle Raw/Parsed Response
              </button>
            </div>

            {showMainAIRaw ?
              renderContent("Storyteller AI Response Raw", debugPacket?.rawResponseText, false) :
              renderContent("Storyteller AI Response Parsed ", debugPacket?.parsedResponse)}

            {debugPacket?.storytellerThoughts && debugPacket.storytellerThoughts.length > 0 ? renderContent(
                "Storyteller Thoughts",
                debugPacket.storytellerThoughts.map(decodeEscapedString).join("\n"),
                false,
              ) : null}

            {debugPacket?.error ? renderContent("Error During Storyteller AI Interaction", debugPacket.error, false) : null}
          </>
        );
      case "MapLocationAI":
        return (
          <>
            <p className="text-sm text-slate-400 mb-2">
              Map Update related to interaction at:
              {timestamp}
            </p>

            {debugPacket?.mapUpdateDebugInfo ? (
              <>
                {renderContent("Cartographer AI Request", debugPacket.mapUpdateDebugInfo.prompt, false)}

                <div className="my-2">
                  <button
                    className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                    onClick={toggleShowMapAIRaw}
                    type="button"
                  >
                    Toggle Raw/Parsed Map Update Response
                  </button>
                </div>

                {showMapAIRaw ?
                  renderContent(
                    "Cartographer AI Response Raw",
                    filterObservationsAndRationale(debugPacket.mapUpdateDebugInfo.rawResponse),
                    false,
                  ) :
                  renderContent("Cartographer AI Response Parsed", debugPacket.mapUpdateDebugInfo.parsedPayload)}

                {debugPacket.mapUpdateDebugInfo.observations ? renderContent(
                    "Cartographer Observations",
                    debugPacket.mapUpdateDebugInfo.observations,
                    false,
                  ) : null}

                {debugPacket.mapUpdateDebugInfo.rationale ? renderContent(
                    "Cartographer Rationale",
                    debugPacket.mapUpdateDebugInfo.rationale,
                    false,
                  ) : null}

                {debugPacket.mapUpdateDebugInfo.validationError ? renderContent("Map Update Validation Error", debugPacket.mapUpdateDebugInfo.validationError, false) : null}

                {debugPacket.mapUpdateDebugInfo.minimalModelCalls ? renderContent("Minimal Model Calls", debugPacket.mapUpdateDebugInfo.minimalModelCalls) : null}

                {debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo &&
                  debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.length > 0 ? debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.map((info, idx) => (
                    <div
                      className="my-2"
                      key={`chain-${String(info.round)}`}
                    >
                      {renderContent(`Connector Chains Prompt (Round ${String(info.round)})`, info.prompt, false)}

                      <div className="my-2">
                        <button
                          className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                          onClick={toggleShowConnectorChainRaw(idx)}
                          type="button"
                        >
                          Toggle Raw/Parsed Connector Chains Response
                        </button>
                      </div>

                      {(showConnectorChainRaw[idx] ?? true)
                        ? info.rawResponse &&
                          renderContent(
                            `Connector Chains Raw Response (Round ${String(info.round)})`,
                            filterObservationsAndRationale(info.rawResponse),
                            false,
                          )
                        : info.parsedPayload &&
                          renderContent(
                            `Connector Chains Parsed Payload (Round ${String(info.round)})`,
                            info.parsedPayload,
                          )}

                      {info.observations ? renderContent(
                          `Connector Chains Observations (Round ${String(info.round)})`,
                          info.observations,
                          false,
                        ) : null}

                      {info.rationale ? renderContent(
                          `Connector Chains Rationale (Round ${String(info.round)})`,
                          info.rationale,
                          false,
                        ) : null}

                      {info.validationError ? renderContent(
                          `Connector Chains Validation Error (Round ${String(info.round)})`,
                          info.validationError,
                          false,
                        ) : null}
                    </div>
                  )) : null}
              </>
            ) : (
              <p className="italic text-slate-400">
                No Map Update AI interaction debug packet captured for the last main AI turn.
              </p>
            )}
          </>
        );
      case "DialogueAI":
        return debugPacket?.dialogueDebugInfo ? (
          <>
            {debugPacket.dialogueDebugInfo.turns.map((t, idx) => {
              const thoughtsText = t.thoughts && t.thoughts.length > 0
                ? t.thoughts.map(th => `Narrator THOUGHTS: "${decodeEscapedString(th)}"`).join('\n')
                : null;
              const responseWithThoughts = thoughtsText ? `${thoughtsText}\n${t.rawResponse}` : t.rawResponse;
              return (
                <div
                  className="mb-2"
                  key={t.prompt}
                >
                    {renderContent(`Turn ${String(idx + 1)} Request`, t.prompt, false)}

                    {renderContent(`Turn ${String(idx + 1)} Response`, responseWithThoughts, false)}
                </div>
              );
            })}

            {debugPacket.dialogueDebugInfo.summaryPrompt ? renderContent(
                "Dialogue Summary Prompt",
                debugPacket.dialogueDebugInfo.summaryPrompt,
                false,
              ) : null}

            {debugPacket.dialogueDebugInfo.summaryRawResponse ? renderContent(
                "Dialogue Summary Response",
                debugPacket.dialogueDebugInfo.summaryRawResponse,
                false,
              ) : null}

            {debugPacket.dialogueDebugInfo.summaryThoughts &&
              debugPacket.dialogueDebugInfo.summaryThoughts.length > 0 ? renderContent(
                "Dialogue Summary Thoughts",
                debugPacket.dialogueDebugInfo.summaryThoughts.map(decodeEscapedString).join("\n"),
                false,
              ) : null}
          </>
        ) : (
          <p className="italic text-slate-400">
            No Dialogue debug info captured.
          </p>
        );
      case "InventoryAI":
        return debugPacket?.inventoryDebugInfo ? (
          <>
            {renderContent(
              "Inventory AI Request",
              debugPacket.inventoryDebugInfo.prompt,
              false,
            )}

            <div className="my-2">
              <button
                className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                onClick={toggleShowInventoryAIRaw}
                type="button"
              >
                Toggle Raw/Parsed Inventory Response
              </button>
            </div>

            {showInventoryAIRaw
              ? renderContent(
                  "Inventory AI Response Raw",
                  filterObservationsAndRationale(debugPacket.inventoryDebugInfo.rawResponse),
                  false,
                )
              : renderContent(
                  "Inventory AI Response Parsed",
                  debugPacket.inventoryDebugInfo.parsedItemChanges,
                )}

            {debugPacket.inventoryDebugInfo.observations ? renderContent(
                "Inventory Observations",
                debugPacket.inventoryDebugInfo.observations,
                false,
              ) : null}

            {debugPacket.inventoryDebugInfo.rationale ? renderContent(
                "Inventory Rationale",
                debugPacket.inventoryDebugInfo.rationale,
                false,
              ) : null}
          </>
        ) : (
          <p className="italic text-slate-400">
            No Inventory AI interaction debug packet captured.
          </p>
        );
      case "Inventory":
        return renderContent("Current Inventory", currentState.inventory, true, "max-h-[70vh]");
      case "Characters":
        return renderContent("Current Characters", currentState.allCharacters, true, "max-h-[70vh]");
      case "MapDataFull":
        return renderContent("Current Map Data (Full)", currentState.mapData, true, "max-h-[70vh]");
      case "ThemeHistory":
        return renderContent("Current Theme History", currentState.themeHistory, true, "max-h-[70vh]");
      case "GameLog":
        return renderContent("Current Game Log", currentState.gameLog, true, "max-h-[70vh]");
      case "TravelPath": {
        if (!travelPath || travelPath.length === 0) {
          return (<p className="italic text-slate-400">
            No destination set.
          </p>);
        }
        const mapData = currentState.mapData;
        const expanded = travelPath.map(step => {
          if (step.step === 'node') {
            const node = mapData.nodes.find(n => n.id === step.id);
            return { step: 'node', data: node ?? { id: step.id, missing: true } };
          }
          if (step.id.startsWith('hierarchy:')) {
            const [from, to] = step.id.split(':')[1].split('->');
            return { step: 'hierarchy', from, to };
          }
          const edge = mapData.edges.find(e => e.id === step.id);
          return { step: 'edge', data: edge ?? { id: step.id, missing: true } };
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
            currentThemeName: currentState.currentThemeName,
            mainQuest: currentState.mainQuest,
            currentObjective: currentState.currentObjective,
            score: currentState.score,
            localTime: currentState.localTime,
            localEnvironment: currentState.localEnvironment,
            localPlace: currentState.localPlace,
            currentMapNodeId: currentState.currentMapNodeId,
            turnsSinceLastShift: currentState.turnsSinceLastShift,
            globalTurnNumber: currentState.globalTurnNumber,
            isCustomGameMode: currentState.isCustomGameMode,
            pendingNewThemeNameAfterShift: currentState.pendingNewThemeNameAfterShift,
            isAwaitingManualShiftThemeSelection: currentState.isAwaitingManualShiftThemeSelection,
            objectiveAnimationType: currentState.objectiveAnimationType,
            lastTurnChangesBrief: currentState.lastTurnChanges ? {
                items: currentState.lastTurnChanges.itemChanges.length,
                chars: currentState.lastTurnChanges.characterChanges.length,
                objAchieved: currentState.lastTurnChanges.objectiveAchieved,
                mapChanged: currentState.lastTurnChanges.mapDataChanged,
            } : null,
        }, true, "max-h-[70vh]");
      default:
        return (<p>
          Select a tab
        </p>);
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
        <button
          aria-label="Close debug view"
          className="animated-frame-close-button"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>

        <h1
          className="text-2xl font-bold text-amber-400 mb-3 text-center flex-shrink-0"
          id="debug-view-title"
        >
          Debug View & Game Internals
        </h1>
        
        <div className="flex flex-wrap border-b border-slate-700 mb-3 flex-shrink-0">
          {tabs.map(tab => (
            <button
              className={`px-3 py-2 text-sm font-medium transition-colors
                          ${activeTab === tab.name
                            ? 'border-b-2 border-sky-400 text-sky-300'
                            : 'text-slate-400 hover:text-sky-400'}`}
              key={tab.name}
              onClick={handleTabClick(tab.name)}
              type="button"
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
}

export default DebugView;
