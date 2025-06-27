import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { jsonSchemaToPrompt, JsonSchema } from '../../../utils/schemaPrompt';
import { filterObservationsAndRationale, decodeEscapedString } from './tabUtils';

interface MapLocationAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function MapLocationAITab({ debugPacket }: MapLocationAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [showChainRaw, setShowChainRaw] = useState<Record<number, boolean>>({});
  const [view, setView] = useState<'reqres' | 'insights' | 'prompt'>('reqres');

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setView('reqres'); }, []);
  const handleShowInsights = useCallback(() => { setView('insights'); }, []);
  const handleShowPrompt = useCallback(() => { setView('prompt'); }, []);
  const handleShowChainRaw = useCallback(
    (idx: number) => () => { setShowChainRaw(prev => ({ ...prev, [idx]: true })); },
    [],
  );
  const handleShowChainParsed = useCallback(
    (idx: number) => () => { setShowChainRaw(prev => ({ ...prev, [idx]: false })); },
    [],
  );

  const timestamp = debugPacket?.timestamp ? new Date(debugPacket.timestamp).toLocaleString() : 'N/A';

  return (
    <>
      <p className="text-sm text-slate-300 mb-2">
        Map Update related to interaction at:
        {timestamp}
      </p>

      {debugPacket?.mapUpdateDebugInfo ? (
        <>
          <div className="my-2 flex flex-wrap gap-2">
            <Button
              ariaLabel="Show request and response"
              label="Req/Res"
              onClick={handleShowReqRes}
              preset={view === 'reqres' ? 'sky' : 'slate'}
              pressed={view === 'reqres'}
              size="sm"
              variant="toggle"
            />

            <Button
              ariaLabel="Show insights"
              label="Insights"
              onClick={handleShowInsights}
              preset={view === 'insights' ? 'sky' : 'slate'}
              pressed={view === 'insights'}
              size="sm"
              variant="toggle"
            />

            <Button
              ariaLabel="Show system prompt"
              label="Prompt"
              onClick={handleShowPrompt}
              preset={view === 'prompt' ? 'sky' : 'slate'}
              pressed={view === 'prompt'}
              size="sm"
              variant="toggle"
            />
          </div>

          {view === 'reqres' ? (
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
                  onClick={handleShowRaw}
                  preset={showRaw ? 'sky' : 'slate'}
                  pressed={showRaw}
                  size="sm"
                  variant="toggle"
                />

                <Button
                  ariaLabel="Show parsed map response"
                  label="Parsed"
                  onClick={handleShowParsed}
                  preset={showRaw ? 'slate' : 'sky'}
                  pressed={!showRaw}
                  size="sm"
                  variant="toggle"
                />
              </div>

              {showRaw ? (
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
            </>
          ) : view === 'insights' ? (
            <>
              {debugPacket.mapUpdateDebugInfo.thoughts && debugPacket.mapUpdateDebugInfo.thoughts.length > 0 ? (
                <DebugSection
                  content={debugPacket.mapUpdateDebugInfo.thoughts.map(decodeEscapedString).join('\n')}
                  isJson={false}
                  maxHeightClass="overflow-visible max-h-fit"
                  title="Cartographer Thoughts"
                />
              ) : null}

              {debugPacket.mapUpdateDebugInfo.observations ? (
                <DebugSection
                  content={debugPacket.mapUpdateDebugInfo.observations}
                  isJson={false}
                  maxHeightClass="overflow-visible max-h-fit"
                  title="Cartographer Observations"
                />
              ) : null}

              {debugPacket.mapUpdateDebugInfo.rationale ? (
                <DebugSection
                  content={debugPacket.mapUpdateDebugInfo.rationale}
                  isJson={false}
                  maxHeightClass="overflow-visible max-h-fit"
                  title="Cartographer Rationale"
                />
              ) : null}
            </>
          ) : (
            <>
              <DebugSection
                content={debugPacket.mapUpdateDebugInfo.systemInstruction ?? 'N/A'}
                isJson={false}
                title="System Prompt"
              />

              {debugPacket.mapUpdateDebugInfo.jsonSchema ? (
                <>
                  <DebugSection
                    content={debugPacket.mapUpdateDebugInfo.jsonSchema}
                    title="Raw Schema"
                  />

                  <DebugSection
                    content={jsonSchemaToPrompt(debugPacket.mapUpdateDebugInfo.jsonSchema as JsonSchema)}
                    isJson={false}
                    title="Schema as Prompt"
                  />
                </>
              ) : null}
            </>
          )}

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
          debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.length > 0
            ? debugPacket.mapUpdateDebugInfo.connectorChainsDebugInfo.map((info, idx) => (
              <div
                className="my-2"
                key={`chain-${String(info.round)}`}
              >
                {view === 'reqres' ? (
                  <>
                    <DebugSection
                      content={info.prompt}
                      isJson={false}
                      title={`Connector Chains Prompt (Round ${String(info.round)})`}
                    />

                    <div className="my-2 flex flex-wrap gap-2">
                      <Button
                        ariaLabel="Show raw connector chain response"
                        label="Raw"
                        onClick={handleShowChainRaw(idx)}
                        preset={showChainRaw[idx] ?? true ? 'sky' : 'slate'}
                        pressed={showChainRaw[idx] ?? true}
                        size="sm"
                        variant="toggle"
                      />

                      <Button
                        ariaLabel="Show parsed connector chain response"
                        label="Parsed"
                        onClick={handleShowChainParsed(idx)}
                        preset={showChainRaw[idx] ?? true ? 'slate' : 'sky'}
                        pressed={!(showChainRaw[idx] ?? true)}
                        size="sm"
                        variant="toggle"
                      />
                    </div>

                    {(showChainRaw[idx] ?? true) ? (
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
                  </>
                ) : view === 'insights' ? (
                  <>
                    {info.thoughts && info.thoughts.length > 0 ? (
                      <DebugSection
                        content={info.thoughts.map(decodeEscapedString).join('\n')}
                        isJson={false}
                        maxHeightClass="overflow-visible max-h-fit"
                        title={`Connector Chains Thoughts (Round ${String(info.round)})`}
                      />
                    ) : null}

                    {info.observations ? (
                      <DebugSection
                        content={info.observations}
                        isJson={false}
                        maxHeightClass="overflow-visible max-h-fit"
                        title={`Connector Chains Observations (Round ${String(info.round)})`}
                      />
                    ) : null}

                    {info.rationale ? (
                      <DebugSection
                        content={info.rationale}
                        isJson={false}
                        maxHeightClass="overflow-visible max-h-fit"
                        title={`Connector Chains Rationale (Round ${String(info.round)})`}
                      />
                    ) : null}
                  </>
                ) : null}

                {info.validationError ? (
                  <DebugSection
                    content={info.validationError}
                    isJson={false}
                    title={`Connector Chains Validation Error (Round ${String(info.round)})`}
                  />
                ) : null}
              </div>
            ))
            : null}
        </>
      ) : (
        <p className="italic text-slate-300">
          No Map Update AI interaction debug packet captured for the last main AI turn.
        </p>
      )}
    </>
  );
}

export default MapLocationAITab;
