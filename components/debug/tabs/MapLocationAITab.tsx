import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { filterObservationsAndRationale, decodeEscapedString } from './tabUtils';

interface MapLocationAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function MapLocationAITab({ debugPacket }: MapLocationAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [showChainRaw, setShowChainRaw] = useState<Record<number, boolean>>({});
  const [showExtras, setShowExtras] = useState(false);

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setShowExtras(false); }, []);
  const handleShowInsights = useCallback(() => { setShowExtras(true); }, []);
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
              preset={!showExtras ? 'sky' : 'slate'}
              pressed={!showExtras}
              size="sm"
              variant="toggle"
            />

            <Button
              ariaLabel="Show insights"
              label="Insights"
              onClick={handleShowInsights}
              preset={showExtras ? 'sky' : 'slate'}
              pressed={showExtras}
              size="sm"
              variant="toggle"
            />
          </div>

          {!showExtras ? (
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
          ) : (
            <>
              {debugPacket.mapUpdateDebugInfo.thoughts && debugPacket.mapUpdateDebugInfo.thoughts.length > 0 ? (
                <DebugSection
                  content={debugPacket.mapUpdateDebugInfo.thoughts.map(decodeEscapedString).join('\n')}
                  isJson={false}
                  title="Cartographer Thoughts"
                />
              ) : null}

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
