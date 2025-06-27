import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { jsonSchemaToPrompt, JsonSchema } from '../../../utils/schemaPrompt';
import { filterObservationsAndRationale, decodeEscapedString } from './tabUtils';

interface InventoryAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function InventoryAITab({ debugPacket }: InventoryAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [view, setView] = useState<'reqres' | 'insights' | 'prompt'>('reqres');

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setView('reqres'); }, []);
  const handleShowInsights = useCallback(() => { setView('insights'); }, []);
  const handleShowPrompt = useCallback(() => { setView('prompt'); }, []);

  return debugPacket?.inventoryDebugInfo ? (
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
            content={debugPacket.inventoryDebugInfo.prompt}
            isJson={false}
            title="Inventory AI Request"
          />

          <div className="my-2 flex flex-wrap gap-2">
            <Button
              ariaLabel="Show raw inventory response"
              label="Raw"
              onClick={handleShowRaw}
              preset={showRaw ? 'sky' : 'slate'}
              pressed={showRaw}
              size="sm"
              variant="toggle"
            />

            <Button
              ariaLabel="Show parsed inventory response"
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
        </>
      ) : view === 'insights' ? (
        <>
          {debugPacket.inventoryDebugInfo.thoughts && debugPacket.inventoryDebugInfo.thoughts.length > 0 ? (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.thoughts.map(decodeEscapedString).join('\n')}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Inventory Thoughts"
            />
          ) : null}

          {debugPacket.inventoryDebugInfo.observations ? (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.observations}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Inventory Observations"
            />
          ) : null}

          {debugPacket.inventoryDebugInfo.rationale ? (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.rationale}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Inventory Rationale"
            />
          ) : null}
        </>
      ) : (
        <>
          <DebugSection
            content={debugPacket.inventoryDebugInfo.systemInstruction ?? 'N/A'}
            isJson={false}
            title="System Prompt"
          />

          {debugPacket.inventoryDebugInfo.jsonSchema ? (
            <>
              <DebugSection
                content={debugPacket.inventoryDebugInfo.jsonSchema}
                title="Raw Schema"
              />

              <DebugSection
                content={jsonSchemaToPrompt(debugPacket.inventoryDebugInfo.jsonSchema as JsonSchema)}
                isJson={false}
                title="Schema as Prompt"
              />
            </>
          ) : null}
        </>
      )}
    </>
  ) : (
    <p className="italic text-slate-300">
      No Inventory AI interaction debug packet captured.
    </p>
  );
}

export default InventoryAITab;
