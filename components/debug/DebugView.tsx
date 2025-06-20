
/**
 * @file DebugView.tsx
 * @description Developer panel for inspecting game state.
 */
import { useState, useCallback } from 'react';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import DebugSection from './DebugSection';

import { extractJsonFromFence } from '../../utils/jsonUtils';
import { GameStateStack, DebugPacket } from '../../types';
import { TravelStep } from '../../utils/mapPathfinding';

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
  const [activeTab, setActiveTab] = useState<DebugTab>('GameState');
  const [showMainAIRaw, setShowMainAIRaw] = useState(true);
  const [showMapAIRaw, setShowMapAIRaw] = useState(true);
  const [showInventoryAIRaw, setShowInventoryAIRaw] = useState(true);
  const [showConnectorChainRaw, setShowConnectorChainRaw] = useState<Record<number, boolean>>({});

  const handleShowMainAIRaw = useCallback(() => { setShowMainAIRaw(true); }, []);
  const handleShowMainAIParsed = useCallback(() => { setShowMainAIRaw(false); }, []);
  const handleShowMapAIRaw = useCallback(() => { setShowMapAIRaw(true); }, []);
  const handleShowMapAIParsed = useCallback(() => { setShowMapAIRaw(false); }, []);
  const handleShowInventoryAIRaw = useCallback(() => { setShowInventoryAIRaw(true); }, []);
  const handleShowInventoryAIParsed = useCallback(() => { setShowInventoryAIRaw(false); }, []);
  const handleShowConnectorChainRaw = useCallback(
    (idx: number) => () => {
      setShowConnectorChainRaw(prev => ({ ...prev, [idx]: true }));
    },
    []
  );
  const handleShowConnectorChainParsed = useCallback(
    (idx: number) => () => {
      setShowConnectorChainRaw(prev => ({ ...prev, [idx]: false }));
    },
    []
  );

  const handleTabClick = useCallback(
    (name: DebugTab) => () => { setActiveTab(name); },
    []
  );

  if (!isVisible) return null;

  const currentState = gameStateStack[0];
  const previousState = gameStateStack[1];

  /**
   * Decodes escaped newline sequences within JSON strings.
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
            <Button
              ariaLabel="Undo last turn"
              disabled={!previousState || currentState.globalTurnNumber <= 1}
              label={`Undo Turn (Global Turn: ${String(currentState.globalTurnNumber)})`}
              onClick={onUndoTurn}
              preset="orange"
              size="sm"
              variant="compact"
            />

            <DebugSection
              content={currentState}
              maxHeightClass="max-h-[30vh]"
              title="Current Game State (Stack[0] - Top)"
            />

            {previousState ? (
              <DebugSection
                content={previousState}
                maxHeightClass="max-h-[30vh]"
                title="Previous Game State (Stack[1] - Bottom)"
              />
            ) : null}
          </>
        );
      case "MainAI":
        return (
          <>
            <p className="text-sm text-slate-300 mb-2">
              Timestamp:
              {timestamp}
            </p>

            <DebugSection
              content={debugPacket?.prompt}
              isJson={false}
              title="Last Storyteller AI Request"
            />

            <div className="my-2 flex flex-wrap gap-2">
              <Button
                ariaLabel="Show raw response"
                label="Raw"
                onClick={handleShowMainAIRaw}
                preset={showMainAIRaw ? 'sky' : 'slate'}
                pressed={showMainAIRaw}
                size="sm"
                variant="toggle"
              />

              <Button
                ariaLabel="Show parsed response"
                label="Parsed"
                onClick={handleShowMainAIParsed}
                preset={showMainAIRaw ? 'slate' : 'sky'}
                pressed={!showMainAIRaw}
                size="sm"
                variant="toggle"
              />
            </div>

            {showMainAIRaw ? (
              <DebugSection
                content={debugPacket?.rawResponseText}
                isJson={false}
                title="Storyteller AI Response Raw"
              />
            ) : (
              <DebugSection
                content={debugPacket?.parsedResponse}
                title="Storyteller AI Response Parsed "
              />
            )}

            {debugPacket?.storytellerThoughts && debugPacket.storytellerThoughts.length > 0 ? (
              <DebugSection
                content={debugPacket.storytellerThoughts.map(decodeEscapedString).join('\n')}
                isJson={false}
                title="Storyteller Thoughts"
              />
            ) : null}

            {debugPacket?.error ? (
              <DebugSection
                content={debugPacket.error}
                isJson={false}
                title="Error During Storyteller AI Interaction"
              />
            ) : null}
          </>
        );
      case "MapLocationAI":
        return (
          <>
            <p className="text-sm text-slate-300 mb-2">
              Map Update related to interaction at:
              {timestamp}
            </p>

            {debugPacket?.mapUpdateDebugInfo ? (
              <>
                <DebugSection
                  content={debugPacket.mapUpdateDebugInfo.prompt}
                  isJson={false}
                  title="Cartographer AI Request"
                />

                <div className="my-2 flex flex-wrap gap-2">
                  <Button
                    ariaLabel="Show raw map response"
                    label="Raw"
                    onClick={handleShowMapAIRaw}
                    preset={showMapAIRaw ? 'sky' : 'slate'}
                    pressed={showMapAIRaw}
                    size="sm"
                    variant="toggle"
                  />

                  <Button
                    ariaLabel="Show parsed map response"
                    label="Parsed"
                    onClick={handleShowMapAIParsed}
                    preset={showMapAIRaw ? 'slate' : 'sky'}
                    pressed={!showMapAIRaw}
                    size="sm"
                    variant="toggle"
                  />
                </div>

                {showMapAIRaw ? (
                  <DebugSection
                    content={filterObservationsAndRationale(debugPacket.mapUpdateDebugInfo.rawResponse)}
                    isJson={false}
                    title="Cartographer AI Response Raw"
                  />
                ) : (
                  <DebugSection
                    content={debugPacket.mapUpdateDebugInfo.parsedPayload}
                    title="Cartographer AI Response Parsed"
                  />
                )}

                {debugPacket.mapUpdateDebugInfo.observations ? (
                  <DebugSection
                    content={debugPacket.mapUpdateDebugInfo.observations}
                    isJson={false}
                    title="Cartographer Observations"
                  />
                ) : null}

                {debugPacket.mapUpdateDebugInfo.rationale ? (
                  <DebugSection
                    content={debugPacket.mapUpdateDebugInfo.rationale}
                    isJson={false}
                    title="Cartographer Rationale"
                  />
                ) : null}

                {debugPacket.mapUpdateDebugInfo.validationError ? (
                  <DebugSection
                    content={debugPacket.mapUpdateDebugInfo.validationError}
                    isJson={false}
                    title="Map Update Validation Error"
                  />
                ) : null}

                {debugPacket.mapUpdateDebugInfo.minimalModelCalls ? (
                  <DebugSection
                    content={debugPacket.mapUpdateDebugInfo.minimalModelCalls}
                    title="Minimal Model Calls"
                  />
                ) : null}

                {debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo &&
                  debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.length > 0 ? debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.map((info, idx) => (
                    <div
                      className="my-2"
                      key={`chain-${String(info.round)}`}
                    >
                      <DebugSection
                        content={info.prompt}
                        isJson={false}
                        title={`Connector Chains Prompt (Round ${String(info.round)})`}
                      />

                      <div className="my-2 flex flex-wrap gap-2">
                        <Button
                          ariaLabel="Show raw connector chain response"
                          label="Raw"
                          onClick={handleShowConnectorChainRaw(idx)}
                          preset={showConnectorChainRaw[idx] ?? true ? 'sky' : 'slate'}
                          pressed={showConnectorChainRaw[idx] ?? true}
                          size="sm"
                          variant="toggle"
                        />

                        <Button
                          ariaLabel="Show parsed connector chain response"
                          label="Parsed"
                          onClick={handleShowConnectorChainParsed(idx)}
                          preset={showConnectorChainRaw[idx] ?? true ? 'slate' : 'sky'}
                          pressed={!(showConnectorChainRaw[idx] ?? true)}
                          size="sm"
                          variant="toggle"
                        />
                      </div>

                      {(showConnectorChainRaw[idx] ?? true) ? (
                        info.rawResponse && (
                          <DebugSection
                            content={filterObservationsAndRationale(info.rawResponse)}
                            isJson={false}
                            title={`Connector Chains Raw Response (Round ${String(info.round)})`}
                          />
                        )
                      ) : (
                        info.parsedPayload && (
                          <DebugSection
                            content={info.parsedPayload}
                            title={`Connector Chains Parsed Payload (Round ${String(info.round)})`}
                          />
                        )
                      )}

                      {info.observations ? (
                        <DebugSection
                          content={info.observations}
                          isJson={false}
                          title={`Connector Chains Observations (Round ${String(info.round)})`}
                        />
                      ) : null}

                      {info.rationale ? (
                        <DebugSection
                          content={info.rationale}
                          isJson={false}
                          title={`Connector Chains Rationale (Round ${String(info.round)})`}
                        />
                      ) : null}

                      {info.validationError ? (
                        <DebugSection
                          content={info.validationError}
                          isJson={false}
                          title={`Connector Chains Validation Error (Round ${String(info.round)})`}
                        />
                      ) : null}
                    </div>
                  )) : null}
              </>
            ) : (
              <p className="italic text-slate-300">
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
                  <DebugSection
                    content={t.prompt}
                    isJson={false}
                    title={`Turn ${String(idx + 1)} Request`}
                  />

                  <DebugSection
                    content={responseWithThoughts}
                    isJson={false}
                    title={`Turn ${String(idx + 1)} Response`}
                  />
                </div>
              );
            })}

            {debugPacket.dialogueDebugInfo.summaryPrompt ? (
              <DebugSection
                content={debugPacket.dialogueDebugInfo.summaryPrompt}
                isJson={false}
                title="Dialogue Summary Prompt"
              />
            ) : null}

            {debugPacket.dialogueDebugInfo.summaryRawResponse ? (
              <DebugSection
                content={debugPacket.dialogueDebugInfo.summaryRawResponse}
                isJson={false}
                title="Dialogue Summary Response"
              />
            ) : null}

            {debugPacket.dialogueDebugInfo.summaryThoughts &&
              debugPacket.dialogueDebugInfo.summaryThoughts.length > 0 ? (
                <DebugSection
                  content={debugPacket.dialogueDebugInfo.summaryThoughts.map(decodeEscapedString).join('\n')}
                  isJson={false}
                  title="Dialogue Summary Thoughts"
                />
            ) : null}
          </>
        ) : (
          <p className="italic text-slate-300">
            No Dialogue debug info captured.
          </p>
        );
      case "InventoryAI":
        return debugPacket?.inventoryDebugInfo ? (
          <>
            <DebugSection
              content={debugPacket.inventoryDebugInfo.prompt}
              isJson={false}
              title="Inventory AI Request"
            />

            <div className="my-2 flex flex-wrap gap-2">
              <Button
                ariaLabel="Show raw inventory response"
                label="Raw"
                onClick={handleShowInventoryAIRaw}
                preset={showInventoryAIRaw ? 'sky' : 'slate'}
                pressed={showInventoryAIRaw}
                size="sm"
                variant="toggle"
              />

              <Button
                ariaLabel="Show parsed inventory response"
                label="Parsed"
                onClick={handleShowInventoryAIParsed}
                preset={showInventoryAIRaw ? 'slate' : 'sky'}
                pressed={!showInventoryAIRaw}
                size="sm"
                variant="toggle"
              />
            </div>

            {showInventoryAIRaw ? (
              <DebugSection
                content={filterObservationsAndRationale(debugPacket.inventoryDebugInfo.rawResponse)}
                isJson={false}
                title="Inventory AI Response Raw"
              />
            ) : (
              <DebugSection
                content={debugPacket.inventoryDebugInfo.parsedItemChanges}
                title="Inventory AI Response Parsed"
              />
            )}

            {debugPacket.inventoryDebugInfo.observations ? (
              <DebugSection
                content={debugPacket.inventoryDebugInfo.observations}
                isJson={false}
                title="Inventory Observations"
              />
            ) : null}

            {debugPacket.inventoryDebugInfo.rationale ? (
              <DebugSection
                content={debugPacket.inventoryDebugInfo.rationale}
                isJson={false}
                title="Inventory Rationale"
              />
            ) : null}
          </>
        ) : (
          <p className="italic text-slate-300">
            No Inventory AI interaction debug packet captured.
          </p>
        );
      case "Inventory":
        return (
          <DebugSection
            content={currentState.inventory}
            maxHeightClass="max-h-[70vh]"
            title="Current Inventory"
          />
        );
      case "Characters":
        return (
          <DebugSection
            content={currentState.allCharacters}
            maxHeightClass="max-h-[70vh]"
            title="Current Characters"
          />
        );
      case "MapDataFull":
        return (
          <DebugSection
            content={currentState.mapData}
            maxHeightClass="max-h-[70vh]"
            title="Current Map Data (Full)"
          />
        );
      case "ThemeHistory":
        return (
          <DebugSection
            content={currentState.themeHistory}
            maxHeightClass="max-h-[70vh]"
            title="Current Theme History"
          />
        );
      case "GameLog":
        return (
          <DebugSection
            content={currentState.gameLog}
            maxHeightClass="max-h-[70vh]"
            title="Current Game Log"
          />
        );
      case "TravelPath": {
        if (!travelPath || travelPath.length === 0) {
          return (<p className="italic text-slate-300">
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
            <DebugSection
              content={travelPath}
              title="Travel Path (IDs)"
            />

            <DebugSection
              content={expanded}
              maxHeightClass="max-h-[70vh]"
              title="Expanded Path Data"
            />
          </>
        );
      }
      case "MiscState":
        return (
          <DebugSection
            content={{
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
          }}
            maxHeightClass="max-h-[70vh]"
            title="Miscellaneous State Values"
          />
        );
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
